import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DelivranceEtape1Component } from './delivrance-etape1.component';

describe('DelivranceEtape1Component', () => {
  let component: DelivranceEtape1Component;
  let fixture: ComponentFixture<DelivranceEtape1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelivranceEtape1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DelivranceEtape1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
