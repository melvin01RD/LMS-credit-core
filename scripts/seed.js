const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const prisma = new PrismaClient();

  try {
    // Borrar si existe
    await prisma.user.deleteMany({
      where: { email: "melvin01rd@gmail.com" }
    });

    const hashedPassword = await bcrypt.hash("Admin123", 10);

    const user = await prisma.user.create({
      data: {
        email: "melvin01rd@gmail.com",
        password: hashedPassword,
        firstName: "Melvin",
        lastName: "Luis",
        role: "ADMIN",
        active: true,
      },
    });

    console.log("✅ Usuario creado:");
    console.log("   Email:", user.email);
    console.log("   Role:", user.role);

    // Verificar que bcrypt funciona
    const match = await bcrypt.compare("Admin123", user.password);
    console.log("   Password match:", match);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();