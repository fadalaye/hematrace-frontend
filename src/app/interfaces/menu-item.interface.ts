export interface MenuItem {
    label: string;
    icon?: string;
    route?: string;
    subMenu?: MenuItem[];
    isHeader?: boolean;
}
