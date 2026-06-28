// === 枚举映射（对应数据库查找表） ===

export type RoleType = 1 | 2 | 3 | 4; // 1=Player, 2=DM, 3=Admin, 4=Store_Manager
export type AccountStatus = 'Active' | 'Locked' | 'Disabled';
export type EmploymentStatus = 'Probation' | 'Active' | 'On_Leave' | 'Terminated';
export type ProficiencyLevel = 'Trained' | 'Proficient' | 'Expert';
export type ShiftType = 'Regular' | 'Overtime' | 'On_Call';
export type GenderRestriction = 'Male' | 'Female' | 'Any';
export type AuthorizationType = 'Boxed' | 'Exclusive' | 'One_Of_A_Kind';
export type AssetCondition = 'Perfect' | 'Worn' | 'In_Maintenance' | 'Scrapped';
export type RoomStatus = 'Operational' | 'Under_Maintenance';
export type SessionStatus = 'Matching' | 'Locked_Ready' | 'In_Progress' | 'Completed' | 'Aborted';
export type PaymentStatus = 'Unpaid' | 'Deposit_Paid' | 'Fully_Paid' | 'Refunded';
export type TransactionType = 'Deposit' | 'Final_Payment' | 'Refund' | 'Adjustment';
export type PaymentMethod = 'WeChat' | 'Alipay' | 'Cash' | 'Bank_Card' | 'Member_Balance';
export type MovementType = 'Purchase_In' | 'Sale_Out' | 'Damage_Loss' | 'Inventory_Adjust' | 'Initial_Stock';
export type CouponStatus = 'Unused' | 'Used' | 'Expired' | 'Revoked';
export type CouponDiscountType = 'Fixed_Amount' | 'Percent_Off';
export type NotificationType = 'Session_Reminder' | 'Payment_Confirm' | 'Coupon_Issued' | 'Coupon_Expiring' | 'System_Announce' | 'Low_Stock_Alert' | 'Review_Request';
export type PointsTransactionType = 'Earn_Session' | 'Earn_Consumption' | 'Earn_Manual' | 'Redeem_Cash' | 'Redeem_Gift' | 'Expire' | 'Adjust';

// === 数据表类型（对应 15 张核心表） ===

export interface Account {
  User_ID: number;
  Account_Name: string;
  Role_Type: RoleType;
  Account_Status: AccountStatus;
  Contact_Phone?: string;
  Account_Created_At: string;
  Last_Login_At?: string;
}

export interface DMProfile {
  DM_User_ID: number;
  DM_Stage_Name: string;
  Base_Per_Session_Wage: number;
  Employment_Status: EmploymentStatus;
  Hire_Date: string;
}

export interface DMScriptCapability {
  Capability_ID: number;
  DM_User_ID: number;
  Script_ID: number;
  Script_Title?: string;
  Proficiency_Level: ProficiencyLevel;
  Certified_At: string;
}

export interface DMShift {
  Shift_ID: number;
  DM_User_ID: number;
  Available_Start: string;
  Available_End: string;
  Shift_Type: ShiftType;
  Script_ID?: number | null;
  Script_Title?: string | null;
  Script_Duration_Minutes?: number | null;
  DM_Stage_Name?: string;
}

export interface Script {
  Script_ID: number;
  Script_Title: string;
  Min_Required_Players: number;
  Max_Allowed_Players: number;
  Estimated_Duration: number; // 分钟
  Base_Price: number;
  Primary_Genre: number;
  Genre_Name?: string;
  Is_Retired: boolean;
}

export interface ScriptRole {
  Role_ID: number;
  Script_ID: number;
  Role_Name: string;
  Gender_Restriction: GenderRestriction;
  Role_Description?: string;
}

export interface ScriptCopy {
  Copy_ID: number;
  Copy_Asset_Barcode: string;
  Script_ID: number;
  Script_Title?: string;
  Authorization_Type: AuthorizationType;
  Asset_Condition: AssetCondition;
  Purchase_Date: string;
  Current_Storage_Location?: string;
}

export interface StoreRoom {
  Room_ID: number;
  Room_Name: string;
  Room_Max_Capacity: number;
  Room_Theme?: string;
  Room_Operating_Status: RoomStatus;
}

export interface Session {
  Session_ID: number;
  Store_ID: number;
  Copy_ID: number;
  Room_ID: number;
  DM_User_ID: number;
  Scheduled_Start_Time: string;
  Scheduled_End_Time: string;
  Session_Status: SessionStatus;
  Frozen_Per_Head_Price: number;
  Created_By_User_ID: number;
  Created_At: string;
  // JOIN 字段
  Script_Title?: string;
  Script_ID?: number;
  Room_Name?: string;
  DM_Stage_Name?: string;
  Player_Count?: number;
  Registered_Count?: number;
  Max_Allowed_Players?: number;
  Min_Required_Players?: number;
  Genre_Name?: string;
  Primary_Genre?: number;
  /** 当前用户在该场次的注册 ID（未参团则为 null） */
  Current_User_Registration_ID?: number | null;
  // JOIN 嵌套字段（详情接口）
  Players?: SessionPlayer[];
  Roles?: SessionRoleDetail[];
}

/** 场次详情中的玩家信息 */
export interface SessionPlayer {
  Registration_ID: number;
  Session_ID: number;
  Player_User_ID: number;
  Role_ID: number | null;
  Account_Name: string;
  Role_Name: string | null;
  Gender_Restriction: GenderRestriction | null;
}

/** 场次详情中的角色信息 */
export interface SessionRoleDetail {
  Role_ID: number;
  Script_ID: number;
  Role_Name: string;
  Gender_Restriction: GenderRestriction;
  Role_Description: string;
  Player_User_ID: number | null;
  Occupied_By: string | null;
}

export interface PlayerRegistration {
  Registration_ID: number;
  Session_ID: number;
  Player_User_ID: number;
  Role_ID: number | null;
  Joined_At: string;
  Cached_Payment_Status: PaymentStatus;
  // JOIN 字段
  Player_Name?: string;
  Role_Name?: string;
  Gender_Restriction?: GenderRestriction;
}

export interface PaymentTransaction {
  Transaction_ID: number;
  Store_ID: number;
  Registration_ID: number;
  Transaction_Type: TransactionType;
  Amount: number;
  Payment_Method: PaymentMethod;
  External_Reference_No?: string;
  Processed_At: string;
  Operator_User_ID: number;
  Remarks?: string;
}

export interface InventoryItem {
  Item_ID: number;
  Item_Name: string;
  Current_Stock_Cache: number;
  Cost_Unit_Price: number;
  Selling_Unit_Price: number;
  Item_Category: string;
  Safety_Alert_Threshold: number;
  Is_Delisted: boolean;
}

export interface InventoryMovement {
  Movement_ID: number;
  Store_ID: number;
  Item_ID: number;
  Quantity_Delta: number;
  Movement_Type: MovementType;
  Related_Session_ID?: number;
  Related_Consumption_ID?: number;
  Operator_User_ID: number;
  Movement_Reason?: string;
  Movement_At: string;
}

export interface SessionConsumption {
  Consumption_ID: number;
  Store_ID: number;
  Session_ID: number;
  Item_ID: number;
  Consumed_Quantity: number;
  Unit_Price_At_Sale: number;
  Line_Total_Cost: number;
  Recording_DM_User_ID: number;
  Recorded_At: string;
  // JOIN 字段
  Item_Name?: string;
}

// 模块六：会员积分
export interface MemberLevel {
  Level_ID: number;
  Level_Name: string;
  Min_Required_Points: number;
  Discount_Rate: number;
  Point_Earning_Multiplier: number;
}

export interface MemberProfile {
  User_ID: number;
  Accumulated_Points: number;
  Current_Level_ID: number;
  Total_Lifetime_Points: number;
  Level_Upgraded_At?: string;
  Level_Name?: string;
  Discount_Rate?: number;
  Point_Earning_Multiplier?: number;
  Next_Level?: MemberLevel | null;
  All_Levels?: MemberLevel[];
}

export interface PointsLedgerEntry {
  Ledger_ID: number;
  User_ID: number;
  Points_Delta: number;
  Transaction_Type: PointsTransactionType;
  Related_Session_ID?: number;
  Related_Registration_ID?: number;
  Points_Balance_After: number;
  Operator_User_ID: number;
  Remarks?: string;
  Created_At: string;
  Operator_Name?: string;
}

// 模块七：优惠券
export interface CouponTemplate {
  Template_ID: number;
  Coupon_Name: string;
  Discount_Type: CouponDiscountType;
  Discount_Value: number;
  Min_Order_Amount: number;
  Max_Discount_Cap?: number;
  Valid_Days_From_Issue: number;
  Applicable_Script_ID?: number;
  Script_Title?: string;
  Total_Issuance_Limit?: number;
  Per_User_Limit: number;
  Is_Active: boolean;
  Created_By_User_ID: number;
  Created_At: string;
}

export interface CouponInstance {
  Coupon_ID: number;
  Template_ID: number;
  User_ID: number;
  Coupon_Status: CouponStatus;
  Issued_At: string;
  Expires_At: string;
  Used_At?: string;
  Issued_By_User_ID: number;
  Verification_Code?: string;
  Coupon_Name?: string;
  Discount_Type?: CouponDiscountType;
  Discount_Value?: number;
  Min_Order_Amount?: number;
  Max_Discount_Cap?: number;
  Applicable_Script_ID?: number;
  Script_Title?: string;
  Account_Name?: string;
}

/** 单张优惠券发放详情（admin 发放后预览） */
export interface IssuedCouponDetail {
  User_ID: number;
  Account_Name: string;
  Verification_Code: string;
  Coupon_Name: string;
  Discount_Type: string;
  Discount_Value: number;
  Expires_At: string;
}

export interface CouponVerifyResult {
  message: string;
  Coupon_ID: number;
  Coupon_Name: string;
  User_Name: string;
  User_ID: number;
  Discount_Type: string;
  Discount_Value: number;
  Discount_Amount: number;
  Applicable_Script_ID?: number;
  Script_Title?: string;
  Is_Redeemed: boolean;
}

// 模块八：评价
export interface SessionReview {
  Review_ID: number;
  Session_ID: number;
  Reviewer_User_ID: number;
  Registration_ID: number;
  DM_Rating: number;
  Script_Rating: number;
  Room_Rating: number;
  Overall_Rating: number;
  Review_Comment?: string;
  Tags?: string;
  Is_Anonymous: boolean;
  Created_At: string;
  Reviewer_Name?: string;
  Script_Title?: string;
  DM_Stage_Name?: string;
  DM_User_ID?: number;
}

export interface DMReviewStats {
  DM_User_ID: number;
  Total_Reviews: number;
  Avg_Overall_Rating: number;
  Avg_DM_Rating: number;
  DM_Stage_Name?: string;
  Rating_Distribution?: { Overall_Rating: number; Count: number }[];
}

// 模块九：通知 (扩展)
export interface AppNotification {
  Notification_ID: number;
  Recipient_User_ID: number;
  Notification_Type: NotificationType;
  Title: string;
  Content?: string;
  Related_Entity_Type?: string;
  Related_Entity_ID?: string;
  Is_Read: boolean;
  Read_At?: string;
  Is_Pushed: boolean;
  Created_At: string;
}

// === 前端专用类型 ===

export interface AuthUser {
  User_ID: number;
  Account_Name: string;
  Role_Type: RoleType;
  DM_User_ID?: number;
  DM_Stage_Name?: string;
  token: string;
}

export interface CartItem {
  Item_ID: number;
  Item_Name: string;
  Selling_Unit_Price: number;
  Quantity: number;
  Line_Total: number;
}

export interface Notification {
  id: number;
  type: 'session_ready' | 'session_cancelled' | 'inventory_alert' | 'new_session' | 'payment_reminder' | 'session_risk';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  link?: string;
}

// === API 响应类型 ===

export interface LobbySession extends Session {
  Player_Count: number;
  Occupied_Roles: number[];
}

export interface SessionGridData {
  date: string;
  rooms: {
    Room_ID: number;
    Room_Name: string;
    sessions: {
      Session_ID: number;
      Script_Title: string;
      DM_Stage_Name: string;
      Start: string;
      End: string;
      Status: SessionStatus;
      Player_Count: number;
      Max_Players: number;
      Frozen_Per_Head_Price: number;
    }[];
  }[];
}

export interface DailySummary {
  date: string;
  total_deposit: number;
  total_final_payment: number;
  total_refund: number;
  total_adjustment: number;
  net_revenue: number;
  by_method: Record<string, number>;
}

export interface PlayerLTV {
  User_ID: number;
  Account_Name: string;
  Lifetime_Days: number;
  Total_Sessions_Attended: number;
  Total_Spent_Script: number;
  Total_Spent_Consumption: number;
  Avg_Per_Session_Spend: number;
  Days_Since_Last_Session: number;
}
