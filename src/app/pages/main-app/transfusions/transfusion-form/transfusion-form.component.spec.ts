import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransfusionFormComponent } from './transfusion-form.component';

describe('TransfusionFormComponent', () => {
  let component: TransfusionFormComponent;
  let fixture: ComponentFixture<TransfusionFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransfusionFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransfusionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
