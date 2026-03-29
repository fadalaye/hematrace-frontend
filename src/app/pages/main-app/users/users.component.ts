import { Component, inject, input, signal, TemplateRef, viewChild, AfterViewInit, ViewChild } from '@angular/core';
import { ContentHeaderComponent } from "../../../widgets/content-header/content-header.component";
import { User } from '../../../interfaces/user.interface';
import { USERS } from '../../../mock-data/users.mock';
import { DatePipe, CommonModule } from '@angular/common';
import { 
  MatTableModule, 
  MatTableDataSource 
} from '@angular/material/table';
import { 
  MatPaginatorModule, 
  MatPaginator 
} from '@angular/material/paginator';
import { 
  MatSortModule, 
  MatSort 
} from '@angular/material/sort';
import { 
  MatFormFieldModule 
} from '@angular/material/form-field';
import { 
  MatInputModule 
} from '@angular/material/input';
import { 
  MatButtonModule 
} from '@angular/material/button';
import { 
  MatIconModule 
} from '@angular/material/icon';
import { 
  MatTooltipModule 
} from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import { saveAs} from 'file-saver';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { EditUserComponent } from "./components/edit-user/edit-user.component";

@Component({
  selector: 'app-users',
  imports: [
    CommonModule,
    ContentHeaderComponent, 
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ModalModule, 
    EditUserComponent
  ],
  providers: [BsModalService],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements AfterViewInit {
  title = 'USERS';
  temp = signal<User[]>([]);
  users = signal<User[]>([]);
  loadingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  private modalService = inject(BsModalService);
  updateItem = signal<User | null>(null);

  // Table Material
  displayedColumns: string[] = [
    'photo',
    'name',
    'genderDob',
    'email', 
    'phone',
    'address',
    'actions'
  ];
  dataSource = new MatTableDataSource<User>([]);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  //Check card for component reusibility
  isCard = input<boolean>(false);

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

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
      this.dataSource.data = users;
    } catch (e) {
      console.error(e);
    } finally {
      this.setLoadingIndicator(false);
    }
  }

  onFilterChange(event: any) {
    const val = event.target.value.toLowerCase();
    const filterData = this.temp().filter((item) => {
      return item?.name.toLowerCase().includes(val) ||
        item.email.toLowerCase().includes(val) ||
        item.gender.toLowerCase().includes(val) ||
        item.address.toLowerCase().includes(val) ||
        item.phone.toLowerCase().includes(val) || !val;
    });
    this.users.set(filterData);
    this.dataSource.data = filterData;
  }

  // Les méthodes onPageChange et onSortChange ne sont plus nécessaires
  // car gérées automatiquement par Material Table

  exportToExcel() {
    const fields = ['id', 'name', 'email', 'phone', 'address', 'gender', 'dob'];
    const values = this.users();
    const sheetname = 'Utilisateurs';
    const data = this.prepareDataInExcel(values, fields);
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data, {
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
    
    const date = new Date().toISOString().split('T')[0];
    saveAs(file, `utilisateurs_${date}.xlsx`);
  }

  prepareDataInExcel(values: User[], fields: string[]) {
    return values.map((value) => {
      const filteredRow: Record<string, any> = {};
      fields.forEach((field) => {
        if (field in value) {
          if (field === 'dob' && value[field as keyof User]) {
            const dateValue = value[field as keyof User] as string;
            filteredRow[field] = this.formatDateForDisplay(dateValue);
          } else {
            filteredRow[field] = value[field as keyof User];
          }
        }
      });
      return filteredRow;
    });
  }

  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  }

  deleteItem(user: User) {
    if (confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${user.name}" ?`)) {
      this.temp.update((users) => users.filter((u) => u.id !== user.id));
      this.users.update((users) => users.filter((u) => u.id !== user.id));
      this.dataSource.data = this.users();
    }
  }

  openUserFormModal(template: TemplateRef<void>, user?: User) {
    this.updateItem.set(user ?? null);
    this.modalRef.set(this.modalService.show(template, { class: 'modal-lg' }));
  }
    
  closeUserModal() {
    this.modalRef()?.hide();
  }
  
  addUser(user: User) {
    this.temp.update((users) => [user, ...users]);
    this.users.update((users) => [user, ...users]);
    this.dataSource.data = this.users();
    this.closeUserModal();
  }

  updateUser(user: User) {
    this.temp.update((users) => users.map((u) => u.id === user.id ? user : u));
    this.users.update((users) => users.map((u) => u.id === user.id ? user : u));
    this.dataSource.data = this.users();
    this.closeUserModal();
  }
}