export type LoginInput = {
  email: string;
  password: string;
};

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
  phone?: string;
};

export type UserRole =
  | "super-admin"
  | "EHS-manager"
  | "hse-officer"
  | "she-committee-member"
  | "supervisor"
  | "gm"
  | "plant-manager"
  | "factory-manager"
  | "depot-admin"
  | "maintenance-manager"
  | "issuer";

export type AuthToken = string;
