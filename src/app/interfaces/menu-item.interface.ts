export interface MenuItem {
    label: string;
    icon?: string;
    route?: string;
    isHeader?: boolean;
    subMenu?: MenuItem[];
}
