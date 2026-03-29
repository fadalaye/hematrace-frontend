import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditIncidentComponent } from './edit-incident.component';

describe('EditIncidentComponent', () => {
  let component: EditIncidentComponent;
  let fixture: ComponentFixture<EditIncidentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditIncidentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditIncidentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
