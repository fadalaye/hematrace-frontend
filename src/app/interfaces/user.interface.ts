export interface User {
    id: number;
    name: string;
    email: string;
    phone: string;
    dob: string; // Date of Birth in 'YYYY-MM-DD' format
    address: string;
    gender: string;
    photo?: string; // Optional URL to the user's photo
}
