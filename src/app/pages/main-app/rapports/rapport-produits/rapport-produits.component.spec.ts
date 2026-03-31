import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportProduitsComponent } from './rapport-produits.component';

describe('RapportProduitsComponent', () => {
  let component: RapportProduitsComponent;
  let fixture: ComponentFixture<RapportProduitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RapportProduitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportProduitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
