import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DelivranceEtape3Component } from './delivrance-etape3.component';

describe('DelivranceEtape3Component', () => {
  let component: DelivranceEtape3Component;
  let fixture: ComponentFixture<DelivranceEtape3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelivranceEtape3Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DelivranceEtape3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
