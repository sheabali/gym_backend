import { PrismaClient, Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial gym accounts...');

  const adminEmail = 'admin@gym.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('AdminSecurePass123!', salt);

    const admin = await prisma.user.create({
      data: {
        name: 'Gym Administrator',
        email: adminEmail,
        phone: '+8801700000000',
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    console.log(`✅ Admin account created: ${admin.email}`);
  } else {
    console.log(`ℹ️ Admin account already exists: ${existingAdmin.email}`);
  }

  const trainerEmail = 'trainer@gym.com';
  const existingTrainer = await prisma.user.findUnique({
    where: { email: trainerEmail },
  });

  if (!existingTrainer) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash('TrainerPass123!', salt);

    const trainer = await prisma.user.create({
      data: {
        name: 'Tanvir Ahmed',
        email: trainerEmail,
        phone: '+8801700000001',
        passwordHash,
        role: Role.TRAINER,
        status: UserStatus.ACTIVE,
        trainerProfile: {
          create: {
            bio: 'Senior Strength & Conditioning Coach with 8+ years experience.',
            specialties: ['Strength Training', 'HIIT', 'Powerlifting'],
            certifications: ['NSCA-CSCS', 'ISSA Elite Trainer'],
            isPublic: true,
            sortOrder: 1,
          },
        },
      },
    });

    console.log(`✅ Sample Trainer account created: ${trainer.email}`);
  } else {
    console.log(`ℹ️ Trainer account already exists: ${existingTrainer.email}`);
  }

  console.log('Seeding initial membership plans (money stored in paisa: 1 BDT = 100 paisa)...');

  const defaultPlans = [
    {
      name: 'Standard Monthly',
      slug: 'standard-monthly',
      description: 'Full gym floor access, locker rooms, and introductory fitness assessment.',
      price: 300000, // 3,000 BDT
      durationDays: 30,
      features: [
        'Full gym floor and cardio zone access',
        'Locker room and shower facilities',
        '1 complimentary fitness assessment',
        'Standard mobile member dashboard',
      ],
      isActive: true,
      isFeatured: false,
      sortOrder: 1,
    },
    {
      name: 'Pro Quarterly',
      slug: 'pro-quarterly',
      description: 'Most popular option. Includes unlimited class attendance and monthly trainer check-ins.',
      price: 800000, // 8,000 BDT
      durationDays: 90,
      features: [
        'All Standard Monthly features',
        'Unlimited group fitness class bookings',
        'Monthly 1-on-1 trainer progress reviews',
        '10% discount on gym merchandise & drinks',
        'Priority booking window (7 days ahead)',
      ],
      isActive: true,
      isFeatured: true,
      sortOrder: 2,
    },
    {
      name: 'VIP Annual',
      slug: 'vip-annual',
      description: 'Complete year-round fitness experience with dedicated locker, free towel service, and guest passes.',
      price: 2500000, // 25,000 BDT
      durationDays: 365,
      features: [
        'All Pro Quarterly features',
        'Dedicated personal locker & premium towel service',
        '4 complimentary guest passes per year',
        '2 free personal training sessions per quarter',
        'Exclusive VIP gym lounge access',
      ],
      isActive: true,
      isFeatured: false,
      sortOrder: 3,
    },
  ];

  for (const planData of defaultPlans) {
    const existingPlan = await prisma.membershipPlan.findUnique({
      where: { slug: planData.slug },
    });

    if (!existingPlan) {
      const plan = await prisma.membershipPlan.create({
        data: planData,
      });
      console.log(`✅ Membership plan created: ${plan.name} (${plan.price / 100} BDT)`);
    } else {
      console.log(`ℹ️ Membership plan already exists: ${existingPlan.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Seed script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
