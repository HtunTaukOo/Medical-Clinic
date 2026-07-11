import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: { patient: true, doctorProfile: true },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          locale: user.locale,
          patientId: user.patient?.id,
          doctorId: user.doctorProfile?.id,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.locale = user.locale;
        token.patientId = user.patientId;
        token.doctorId = user.doctorId;
      }
      return token;
    },
    session: ({ session, token }) => {
      session.user.id = token.sub as string;
      session.user.role = token.role;
      session.user.locale = token.locale;
      session.user.patientId = token.patientId;
      session.user.doctorId = token.doctorId;
      return session;
    },
  },
});
