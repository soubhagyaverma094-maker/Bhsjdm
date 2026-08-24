// ============================================================
// app/dashboard/page.tsx
// Brand Boosting Network CRM — Main dashboard (leads action list)
// ============================================================
'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createClient, timeAgo, formatBudget, formatService,
  type Lead, type Temperature,
} from '../../lib/supabase';
