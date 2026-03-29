import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDelivranceComponent } from './edit-delivrance.component';

describe('EditDelivranceComponent', () => {
  let component: EditDelivranceComponent;
  let fixture: ComponentFixture<EditDelivranceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditDelivranceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditDelivranceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
