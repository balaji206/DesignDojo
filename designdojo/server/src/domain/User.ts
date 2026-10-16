export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
}

export interface UserRepository {
  create(user: { id: string; email: string; passwordHash: string; name: string }): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
}
