import { NextResponse } from "next/server";
import { registerUser } from "@/features/auth/register";
import { registerSchema } from "@/features/auth/validation";

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud no válido." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos." },
      { status: 400 },
    );
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ userId: result.userId }, { status: 201 });
}
