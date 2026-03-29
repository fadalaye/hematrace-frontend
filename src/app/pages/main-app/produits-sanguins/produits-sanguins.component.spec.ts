import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProduitsSanguinsComponent } from './produits-sanguins.component';

describe('ProduitsSanguinsComponent', () => {
  let component: ProduitsSanguinsComponent;
  let fixture: ComponentFixture<ProduitsSanguinsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProduitsSanguinsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProduitsSanguinsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
