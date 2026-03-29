import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditProduitSanguinComponent } from './edit-produit-sanguin.component';

describe('EditProduitSanguinComponent', () => {
  let component: EditProduitSanguinComponent;
  let fixture: ComponentFixture<EditProduitSanguinComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditProduitSanguinComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditProduitSanguinComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
