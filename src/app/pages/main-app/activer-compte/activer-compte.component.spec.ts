import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiverCompteComponent } from './activer-compte.component';

describe('ActiverCompteComponent', () => {
  let component: ActiverCompteComponent;
  let fixture: ComponentFixture<ActiverCompteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiverCompteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiverCompteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
