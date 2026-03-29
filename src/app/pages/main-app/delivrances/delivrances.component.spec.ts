import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DelivrancesComponent } from './delivrances.component';

describe('DelivrancesComponent', () => {
  let component: DelivrancesComponent;
  let fixture: ComponentFixture<DelivrancesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelivrancesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DelivrancesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
