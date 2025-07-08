import { Injectable } from '@angular/core';
import { Recipe } from '../models/Recipe';

@Injectable({
  providedIn: 'root'
})
export class CommonService {
  selectedRecipe: Recipe | null = null;
  recipeList: Array<Recipe> = [];
  selectedImage: File | null = null;
  isBack: boolean = false;
  constructor() { }

}
