import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HematraceLayoutComponent } from './hematrace-layout.component';

describe('HematraceLayoutComponent', () => {
  let component: HematraceLayoutComponent;
  let fixture: ComponentFixture<HematraceLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HematraceLayoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HematraceLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
