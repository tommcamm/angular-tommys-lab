import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MultiStepFlow } from './multi-step-flow';

describe('MultiStepFlow', () => {
  let fixture: ComponentFixture<MultiStepFlow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiStepFlow],
    }).compileComponents();

    fixture = TestBed.createComponent(MultiStepFlow);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the Start button', () => {
    const btn = fixture.nativeElement.querySelector<HTMLButtonElement>(
      'button[type="button"]',
    );
    expect(btn?.textContent?.trim()).toBe('Start');
  });
});
