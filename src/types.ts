
export enum TaskStatus {
  TODO = 'TODO',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum TaskType {
  PLAN = 'PLAN',
  ACTUAL = 'ACTUAL',
  DEVICE_LOG = 'DEVICE_LOG'
}

// Time Value Classification
export type TimeValue = 'investment' | 'consumption' | 'maintenance';

export type ChartType = 'apps' | 'trend' | 'hours' | 'execution' | 'capital';

export type Priority = 'high' | 'medium' | 'low';

export interface TimeBlock {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: number; // Minutes from 00:00 (e.g., 600 = 10:00 AM)
  duration: number; // Minutes
  type: TaskType;
  status: TaskStatus;
  description?: string;
  color?: string;
  deviceSource?: 'mobile' | 'desktop' | 'tablet';
  createdAt?: number;
  updatedAt?: number;
  origin?: 'goal' | 'user';
  goalId?: string;
  milestoneId?: string;
  relatedPlanId?: string;
  
  // Simplified Fields
  timeValue?: TimeValue; // Default 'maintenance'
  priority?: Priority;
}

export interface DayTemplate {
  id: string;
  name: string;
  tasks:  Omit<TimeBlock, 'id' | 'date' | 'createdAt' | 'updatedAt'>[];
}

export type GoalCategory = 'health' | 'learning' | 'career' | 'life' | 'financial' | 'other';
export type GoalFrequency = 'daily' | 'weekly' | 'monthly' | 'once';

// Knowledge Map Layers
export type GoalLayer = 'principle' | 'method' | 'application'; // Bottom, Middle, Top

export interface Milestone {
  id: string;
  title: string;
  isCompleted: boolean;
  totalUnits?: number;
  completedUnits?: number;
  unitName?: string;
}

export interface Goal {
  id: string;
  title: string;
  totalUnits: number;
  completedUnits: number;
  unitName: string;
  color: string;
  description?: string;
  deadline?: string;
  priority?: Priority;
  status?: 'active' | 'completed' | 'archived';
  createdAt?: number;
  updatedAt?: number;
  category?: GoalCategory;
  frequency?: GoalFrequency;
  milestones?: Milestone[];

  // Long-term Focus & Systems Thinking
  layer?: GoalLayer; // Where does this fit in the knowledge map?
  isMainThread?: boolean; // Is this the ONE main thing?
  sacrificeStatement?: string; // "I am willing to sacrifice Y for X"
  
  // OKR Hierarchy
  parentId?: string; // Link to parent Objective
}

export interface WebDavConfig {
  url: string;
  user: string;
  pass: string;
  enabled: boolean;
  targetFolder?: string;
  corsProxy?: string;
  loginMode?: 'manual' | 'sso';
}

export interface AppState {
  tasks: TimeBlock[];
  goals: Goal[];
  templates: DayTemplate[];
  
  systemVersion?: string;
  systemVersionNotes?: string;
  
  lastSynced?: number;
  webDavConfig: WebDavConfig;

  deviceMonitorConfig?: {
      serverUrl: string;
      enabled: boolean;
  };
}
