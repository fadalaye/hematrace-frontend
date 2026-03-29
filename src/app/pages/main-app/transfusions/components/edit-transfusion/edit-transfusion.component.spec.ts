import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTransfusionComponent } from './edit-transfusion.component';

describe('EditTransfusionComponent', () => {
  let component: EditTransfusionComponent;
  let fixture: ComponentFixture<EditTransfusionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransfusionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditTransfusionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => { 
    expect(component).toBeTruthy();
  });
});
