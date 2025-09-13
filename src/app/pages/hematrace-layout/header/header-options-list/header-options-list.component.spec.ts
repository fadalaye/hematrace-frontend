import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderOptionsListComponent } from './header-options-list.component';

describe('HeaderOptionsListComponent', () => {
  let component: HeaderOptionsListComponent;
  let fixture: ComponentFixture<HeaderOptionsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderOptionsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderOptionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
