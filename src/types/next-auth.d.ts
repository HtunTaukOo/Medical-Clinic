import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: Role;
    locale: string;
    patientId?: string;
    doctorId?: string;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      locale: string;
      patientId?: string;
      doctorId?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    locale: string;
    patientId?: string;
    doctorId?: string;
  }
}
