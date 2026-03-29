import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DelivranceEtape2Component } from './delivrance-etape2.component';

describe('DelivranceEtape2Component', () => {
  let component: DelivranceEtape2Component;
  let fixture: ComponentFixture<DelivranceEtape2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelivranceEtape2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DelivranceEtape2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
