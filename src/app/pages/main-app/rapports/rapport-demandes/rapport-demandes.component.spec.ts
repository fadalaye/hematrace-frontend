import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportDemandesComponent } from './rapport-demandes.component';

describe('RapportDemandesComponent', () => {
  let component: RapportDemandesComponent;
  let fixture: ComponentFixture<RapportDemandesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RapportDemandesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportDemandesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
