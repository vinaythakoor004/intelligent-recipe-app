import { Routes } from '@angular/router';
import { SearchComponent } from './search/search.component';
import { DetailsComponent } from './search/details/details.component';

export const routes: Routes = [
  { path: '', redirectTo: '/recipe', pathMatch: 'full' },
  {
    path: 'recipe', children: [
      { path: '', component: SearchComponent },
      {
        path: 'details', component: SearchComponent
      }
    ]
  },
  {
    path: 'details', component: DetailsComponent
  }
];
