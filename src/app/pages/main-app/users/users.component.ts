import { Component, signal, viewChild } from '@angular/core';
import { ContentHeaderComponent } from "../../../widgets/content-header/content-header.component";
import { ColumnMode, DatatableComponent, NgxDatatableModule } from '@swimlane/ngx-datatable';
import { User } from '../../../interfaces/user.interface';
import { USERS } from '../../../mock-data/users.mock';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as XLSX from 'xlsx';
import { saveAs} from 'file-saver';
import { ModalModule, BsModalService } from 'ngx-bootstrap/modal';

@Component({
  selector: 'app-users',
  imports: [ContentHeaderComponent, NgxDatatableModule, DatePipe, 
    MatButtonModule, MatIconModule, ModalModule],
  providers: [BsModalService],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  //@viewChild(DatatableComponent) table = DatatableComponent;
  table = viewChild<DatatableComponent>(DatatableComponent);
  title = 'USERS';
  temp = signal<User[]>([]);
  users = signal<User[]>([]);
  columnMode = ColumnMode;
  loadingIndicator = signal<boolean>(false);
  setLoadingIndicator(value: boolean) {
    this.loadingIndicator.set(value);
  }
  ngOnInit() {
    console.log('ngOnInit users');
    this.getUsers();
  }

  async getUsers() {
    try {
      this.setLoadingIndicator(true);
      const users = USERS;
      this.users.set(users);
      this.temp.set(users);
    } catch (e) {
      console.error(e);
    } finally {
      this.setLoadingIndicator(false);
    }
  }

  onFilterChange(event: any) {
    console.log(event.target.value);
    const val = event.target.value.toLowerCase();
    const filterData = this.temp().filter((item) => {
      return item?.name.toLowerCase().indexOf(val) !== -1 ||
        item.email.toLowerCase().indexOf(val) !== -1 ||
        item.gender.toLowerCase().indexOf(val) !== -1 ||
        item.address.toLowerCase().indexOf(val) !== -1 ||
        item.phone.toLowerCase().indexOf(val) !== -1 || !val;
    });
    this.users.set(filterData);
    this.table()!.offset = 0 ;
  }

  onPageChange(event: any) {
    console.log(event);
  }
  onSortChange(event: any) {
    console.log(event);
  }

  exportToExcel() {
    const fields = ['id', 'name', 'email', 'phone', 'address'];
    const values = this.users();
    const sheetname = 'Users';
    const data = this.prepareDataInExcel(values, fields);
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data, {
      //header: Object.keys(data[0]),

      //header : Object.values(headers),
      header: fields,
    });

    const workBook: XLSX.WorkBook = {
      Sheets: { [sheetname]: worksheet },
      SheetNames: [sheetname],
    };

    const excelBuffer: any = XLSX.write(workBook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const file = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });
    //const fileName = `users_${new Date().getTime()}.xlsx`;
    saveAs(file, "users.xlsx");

  }

  prepareDataInExcel(values: User[], fields: string[]) {
    const dataExport = values.map((value) => {
      const filteredRow: Record<string, any> = {};
      fields.forEach((field, index) => {
        if (field in value) {
          filteredRow[field] = value[field as keyof User];
        }
      });
      return filteredRow;
    });
  /*   const headers = fields.reduce((acc, field) => {
      //acc[field] = field;
      acc[field] = field.charAt(0).toUpperCase() + field.slice(1);
      return acc;
    }, {} as Record<string, any>
  ) */

    return dataExport;
  }

  deleteItem(user: User) {
    this.temp.update((users) => users.filter((u) => u.id !== user.id));
    this.users.update((users) => users.filter((u) => u.id !== user.id));
  }

}
