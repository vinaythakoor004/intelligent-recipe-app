import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonService } from '../../services/common.service';
import { Recipe } from '../../models/Recipe';

@Component({
  selector: 'app-details',
  imports: [ CommonModule, FormsModule ],
  templateUrl: './details.component.html',
  styleUrl: './details.component.css'
})
export class DetailsComponent implements OnInit {
  selectedRecipe: Recipe | null = null;
  currentImageIndex: number = 0; // For carousel
  defaultFallbackImage = 'assets/images/default-food-image.jpg';

  constructor(private commonService: CommonService) {

  }

  ngOnInit() {
    if (this.commonService?.selectedRecipe) {
      this.selectedRecipe = this.commonService?.selectedRecipe;
    }
  }

  /**
   * Navigates to the next image in the carousel.
   */
  nextImage(): void {
    if (this.selectedRecipe && this.selectedRecipe.imageUrls) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.selectedRecipe.imageUrls.length;
    }
  }

  /**
   * Navigates to the previous image in the carousel.
   */
  prevImage(): void {
    if (this.selectedRecipe && this.selectedRecipe.imageUrls) {
      this.currentImageIndex = (this.currentImageIndex - 1 + this.selectedRecipe.imageUrls.length) % this.selectedRecipe.imageUrls.length;
    }
  }

  /**
   * Clears the selected recipe, returning to the main recipe list/grid view.
   */
  goBackToList(): void {
    this.selectedRecipe = null;
    this.currentImageIndex = 0; // Reset carousel index
  }


}
