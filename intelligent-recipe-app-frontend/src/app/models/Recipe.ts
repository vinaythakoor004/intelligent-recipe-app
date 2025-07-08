export class Recipe {
  recipeName: string;
  ingredients: string[];
  instructions: string[];
  imageUrls?: string[];

  constructor(
    recipeName: string,
    ingredients: string[],
    instructions: string[],
    imageUrls?: string[]
  ) {
      this.recipeName = recipeName;
      this.ingredients = ingredients;
      this.instructions = instructions;
      this.imageUrls = imageUrls;
  }
}
