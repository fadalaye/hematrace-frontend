import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransfusionsComponent } from './transfusions.component';

describe('TransfusionsComponent', () => {
  let component: TransfusionsComponent;
  let fixture: ComponentFixture<TransfusionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransfusionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransfusionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
