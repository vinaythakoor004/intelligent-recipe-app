import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';   // For ngModel (two-way data binding)
import { GeminiService } from '../services/gemini.service';
import { catchError, finalize, forkJoin, map, Observable, of, Subscription } from 'rxjs';
import { CommonService } from '../services/common.service';
import { Recipe } from '../models/Recipe';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search',
  imports: [ CommonModule, FormsModule ],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css'
})
export class SearchComponent {
  selectedFile: File | null = null;
  imagePreviewUrl: string | ArrayBuffer | null = null;
  readingFile: boolean = false;
  selectedRecipe: Recipe | null = null;
  recipes: (Recipe & { loadingImage?: boolean })[] = [];
  loadingRecipes: boolean = false;
  loadingImages: boolean = false;
  error: string = '';
  selectedCuisine: string = 'Indian';
  currentImageIndex: number = 0;
  inputType: 'image' | 'text' = 'image';
  textIngredients: string = '';
  private recipeSubscription: Subscription | undefined;
  private imageSubscriptions: Subscription[] = [];
  defaultFallbackImage = 'assets/images/default-food-image.jpg';
  isBack: boolean = false;
  @ViewChild('imageUploadInput') fileInput!: ElementRef;

  constructor(private geminiService: GeminiService, private commonService: CommonService, private router: Router ) { }

  ngOnInit(): void {
    if (this.commonService.isBack) {
      this.selectedFile = this.commonService.selectedImage;
      this.recipes = this.commonService.recipeList;
      this.isBack = true;
      this.commonService.isBack = false;
    }
  }

    ngAfterViewInit() {
      if (this.selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviewUrl = reader.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
    }

  /**
   * Handles the file selection from the input element.
   * Reads the selected image file as a Base64 string for API submission.
   * @param event The DOM event from the file input change.
   */
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];

    if (file) {
      this.selectedFile = file;
      this.error = '';
      this.recipes = [];
      this.commonService.selectedRecipe = null;
      this.currentImageIndex = 0;

      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreviewUrl = reader.result;
      };
      reader.onerror = (err) => {
        console.error("File reading error:", err);
        this.error = "Failed to read image file.";
        this.selectedFile = null;
        this.imagePreviewUrl = null;
        this.readingFile = false;
      };

      this.readingFile = true;
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        this.readingFile = false;
      };
    } else {
      this.selectedFile = null;
      this.imagePreviewUrl = null;
    }
  }

  clearImage(): void {
    this.selectedFile = null;
    this.imagePreviewUrl = null;
    this.readingFile = false;
    this.recipes = [];
    this.error = '';
    this.loadingRecipes = false;
    this.loadingImages = false;
    this.commonService.selectedRecipe = null;
    this.commonService.recipeList = [];
    this.commonService.selectedImage = null;
    this.currentImageIndex = 0;

  }

  /**
   * Toggles the input type between image upload and text input.
   * Clears relevant data when switching.
   * @param type The desired input type ('image' or 'text').
   */
  toggleInputType(type: 'image' | 'text'): void {
    this.inputType = type;
    this.error = '';
    this.recipes = [];
    this.commonService.selectedRecipe = null;
    this.commonService.recipeList = [];
    this.commonService.selectedImage = null;
    this.loadingRecipes = false;
    this.loadingImages = false;
    this.currentImageIndex = 0;

    if (type === 'image') {
      this.textIngredients = '';
    } else {
      this.selectedFile = null;
      this.imagePreviewUrl = null;
      this.readingFile = false;
    }
  }

  /**
   * Handles the form submission to send input (image or text) to the Gemini API for recipe suggestions.
   */
  handleSubmit(): void {
    this.error = '';
    this.loadingRecipes = true;
    this.loadingImages = false;
    this.recipes = [];
    this.commonService.selectedRecipe = null;
    this.currentImageIndex = 0;

    if (this.inputType === 'image') {
      if (!this.selectedFile) {
        this.error = "Please upload an image of your ingredients.";
        this.loadingRecipes = false;
        return;
      }
      if (this.readingFile) {
        this.error = "Please wait, image is still being processed.";
        this.loadingRecipes = false;
        return;
      }
      const base64ImageData = (this.imagePreviewUrl as string).split(',')[1];

      this.geminiService.isFoodImage(base64ImageData).pipe(
        catchError(err => {
          this.error = err.message || "Error validating image content.";
          this.loadingRecipes = false;
          return of(false);
        })
      ).subscribe(isFood => {
        if (!isFood) {
          this.error = "The uploaded image does not appear to contain food ingredients. Please upload a clear photo of ingredients.";
          this.loadingRecipes = false;
          return;
        }
        this.fetchRecipes(base64ImageData, this.selectedCuisine, 'image');
      });
    } else {
      if (!this.textIngredients.trim()) {
        this.error = "Please enter some ingredients.";
        this.loadingRecipes = false;
        return;
      }
      this.fetchRecipes(this.textIngredients, this.selectedCuisine, 'text');
    }
  }

  /**
   * Centralized method to fetch recipes, either from image or text.
   * @param inputData The image Base64 data or text ingredients.
   * @param cuisine The selected cuisine.
   * @param inputType The type of input ('image' or 'text').
   */
  private fetchRecipes(inputData: string, cuisine: string, inputType: 'image' | 'text'): void {
    let recipeObservable: Observable<Recipe[]>;

    if (inputType === 'image') {
      recipeObservable = this.geminiService.getRecipesFromImage(inputData, cuisine);
    } else {
      recipeObservable = this.geminiService.getRecipesFromText(inputData, cuisine);
    }

    this.recipeSubscription = recipeObservable.pipe(
      finalize(() => this.loadingRecipes = false)
    ).subscribe({
      next: (data: Recipe[]) => {
        this.recipes = data.map(recipe => ({ ...recipe, loadingImage: true, imageUrls: [] }));
        if (this.recipes.length === 0) {
            this.error = "No recipes found. Please try different ingredients or a different picture.";
            return;
        }

        this.loadingImages = true;
        const imageObservables = this.recipes.map((recipe, index) =>
          this.geminiService.searchPixabayImage(recipe.recipeName).pipe(
            map(imageUrls => {
              recipe.imageUrls = imageUrls;
              return { index, success: true };
            }),
            catchError((imgErr) => {
              console.error(`Error fetching image for ${recipe.recipeName} from Pixabay:`, imgErr);
              recipe.imageUrls = [this.defaultFallbackImage];
              return of({ index, success: false, error: imgErr });
            }),
            finalize(() => {
              if (this.recipes[index]) {
                this.recipes[index].loadingImage = false;
              }
            })
          )
        );

        this.imageSubscriptions.push(
          forkJoin(imageObservables).pipe(
            finalize(() => this.loadingImages = false)
          ).subscribe({
            next: () => { console.log("All image fetches attempted from Pixabay."); },
            error: (err) => { console.error("Error in forkJoin for Pixabay images:", err); }
          })
        );
      },
      error: (err: Error) => {
        this.error = err.message || "An unexpected error occurred.";
        this.recipes = [];
        this.loadingRecipes = false;
      }
    });
  }

  /**
   * Sets the selected recipe to display its full details.
   * @param recipe The recipe object to display.
   */
  showRecipeDetail(recipe: Recipe): void {
    const url = this.router.url + '/details';
    this.selectedRecipe = recipe;
    this.commonService.selectedRecipe = recipe;
    this.currentImageIndex = 0;
    this.commonService.recipeList = this.recipes;
    this.commonService.selectedImage = this.selectedFile;
    this.isBack = false;
    this.router.navigate([url]);
  }

  /**
   * Angular lifecycle hook called when the component is destroyed.
   * Used to unsubscribe from Observables to prevent memory leaks.
   */
  ngOnDestroy(): void {
    if (this.recipeSubscription) {
      this.recipeSubscription.unsubscribe();
    }
    this.imageSubscriptions.forEach(sub => sub.unsubscribe());
  }
}
