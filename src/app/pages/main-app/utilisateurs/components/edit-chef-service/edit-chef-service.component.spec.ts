import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditChefServiceComponent } from './edit-chef-service.component';

describe('EditChefServiceComponent', () => {
  let component: EditChefServiceComponent;
  let fixture: ComponentFixture<EditChefServiceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditChefServiceComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditChefServiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
