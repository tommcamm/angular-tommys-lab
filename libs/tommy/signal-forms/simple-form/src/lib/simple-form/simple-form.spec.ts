import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleForm } from './simple-form';

describe('SimpleForm', () => {
  let fixture: ComponentFixture<SimpleForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleForm],
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleForm);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function input(name: string): HTMLInputElement {
    const el = fixture.nativeElement.querySelector<HTMLInputElement>(
      `input[type="${name}"]`,
    );
    if (!el) throw new Error(`missing input[type="${name}"]`);
    return el;
  }

  async function type(el: HTMLInputElement, value: string): Promise<void> {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('disables the submit button until every field is valid', async () => {
    const submit = fixture.nativeElement.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(submit?.disabled).toBe(true);

    await type(input('text'), 'Tommy');
    await type(input('email'), 'tommy@example.com');
    await type(input('password'), 'super-secret');
    await type(input('number'), '30');

    expect(submit?.disabled).toBe(false);
  });

  it('writes input values back into the field tree via [formField]', async () => {
    await type(input('email'), 'tommy@example.com');
    expect(fixture.componentInstance['form'].email().value()).toBe(
      'tommy@example.com',
    );
  });
});
