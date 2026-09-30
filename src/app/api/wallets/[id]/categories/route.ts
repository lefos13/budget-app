import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wallet = await prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const membership = await prisma.walletMember.findUnique({
      where: {
        walletId_userId: {
          walletId: id,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the wallet owner can manage categories' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, color, icon, monthlyLimit } = body;

    // Validate name: required, trimmed, <= 40 chars
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) {
      return NextResponse.json(
        { error: 'Name is required, non-empty, and must be at most 40 characters' },
        { status: 400 }
      );
    }
    const trimmedName = name.trim();

    // Validate color: default '#3b82f6', must match /^#[0-9a-fA-F]{6}$/
    let finalColor = '#3b82f6';
    if (color !== undefined && color !== null && color !== '') {
      if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
        return NextResponse.json(
          { error: 'Color must match hex format /^#[0-9a-fA-F]{6}$/' },
          { status: 400 }
        );
      }
      finalColor = color.trim();
    }

    // Validate icon: default 'Tag', string 1-30 chars [A-Za-z0-9]
    let finalIcon = 'Tag';
    if (icon !== undefined && icon !== null && icon !== '') {
      if (typeof icon !== 'string' || !/^[A-Za-z0-9]{1,30}$/.test(icon.trim())) {
        return NextResponse.json(
          { error: 'Icon must be 1-30 alphanumeric characters' },
          { status: 400 }
        );
      }
      finalIcon = icon.trim();
    }

    // Validate monthlyLimit: null/''/undefined -> null (no cap), otherwise finite number >= 0
    let finalMonthlyLimit: number | null = null;
    if (monthlyLimit !== undefined && monthlyLimit !== null && monthlyLimit !== '') {
      const num = typeof monthlyLimit === 'number'
        ? monthlyLimit
        : (typeof monthlyLimit === 'string' && monthlyLimit.trim() !== '' ? Number(monthlyLimit) : NaN);
      if (isNaN(num) || !isFinite(num) || num < 0) {
        return NextResponse.json(
          { error: 'Monthly limit must be a non-negative finite number or null' },
          { status: 400 }
        );
      }
      finalMonthlyLimit = num;
    }

    // Duplicate name in the same wallet (case-insensitive, trimmed) -> 409
    const existingCategories = await prisma.category.findMany({
      where: { walletId: id },
      select: { name: true },
    });
    const isDuplicate = existingCategories.some(
      (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'A category with this name already exists in this wallet' },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        walletId: id,
        name: trimmedName,
        color: finalColor,
        icon: finalIcon,
        monthlyLimit: finalMonthlyLimit,
      },
    });

    await prisma.activityLog.create({
      data: {
        walletId: id,
        userId: user.id,
        action: 'CATEGORY_CREATED',
        details: `${user.name} created category "${category.name}"`,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
