import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RapportIncidentsComponent } from './rapport-incidents.component';

describe('RapportIncidentsComponent', () => {
  let component: RapportIncidentsComponent;
  let fixture: ComponentFixture<RapportIncidentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RapportIncidentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RapportIncidentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
