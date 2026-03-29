import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../../../../interfaces/user.interface';
import { BsDatepickerConfig, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { NgxSelectModule } from 'ngx-select-ex';
import { MatButton, MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-edit-user',
  providers: [DatePipe],
  imports: [ReactiveFormsModule, BsDatepickerModule, NgxSelectModule, MatButtonModule, MatIconModule],
  templateUrl: './edit-user.component.html',
  styleUrl: './edit-user.component.scss'
})
export class EditUserComponent implements OnInit {
  ngOnInit() {
    this.initForm();
  }
  formData = signal<FormGroup | null>(null);
  updateItem = input<User>();

  datePickerConfig: Partial<BsDatepickerConfig> = Object.assign({},
    {
      containerClass: 'theme-dark-blue',
      //showWeekNumbers: false,
      dateInputFormat: 'YYYY-MM-DD',
      // maxDate: new Date(),
      // isAnimated: true,
    });

  addedData = output<User>();
  updateData = output<User>();
  private formBuilder = inject(FormBuilder);
  private datePipe = inject(DatePipe);
  constructor() { };
  initForm() {
    const item = this.updateItem();
    const form = this.formBuilder.group({
      name: [item?.name ?? null, Validators.required ],
      email: [item?.email ?? null, [Validators.required, Validators.email]],
      phone : [item?.phone ?? null, Validators.required ],
      gender: [item?.gender ?? null, Validators.required ],
      dob : [item?.dob ?? null, Validators.required ],
      address : item?.address ?? null
    });

    this.formData.set(form);
  }

  onSubmit() {
      if (this.formData()?.invalid) {
        this.formData()?.markAllAsTouched();
        return;
      }

      console.log(this.formData()?.value);

      this.saveUser();
  }
  saveUser() {
    //format data
    const dob = this.dateFormat(this.formData()?.value.dob, 'yyyy-MM-dd');
    const data = { ...this.formData()?.value, dob };
    console.log(data);

    if (this.updateItem()) {
      // update user
      this.updateData.emit({...this.updateItem(), ...data});
    } else {
      // create 
      this.addedData.emit({...data, id: 100});
    }
  }
  dateFormat(date: Date, format: string) {
    return this.datePipe.transform(date, format);

  }

}
