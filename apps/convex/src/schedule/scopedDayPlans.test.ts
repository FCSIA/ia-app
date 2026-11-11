/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it, vi } from 'vitest';
import schema from '../schema';
import { api } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import { loadDayPlanSource } from './dayPlans';
const auth = vi.hoisted(() => ({ userId: null as Id<'users'> | null }));
vi.mock('../../lib/currentUser', async (original) => {
  const actual = await original<typeof import('../../lib/currentUser')>();
  const maybe = async (ctx: {db:{get:(id:Id<'users'>)=>Promise<Doc<'users'>|null>}}) => auth.userId ? ctx.db.get(auth.userId) : null;
  return {...actual, getMaybeCurrentAppUser: maybe, getCurrentAppUser: async (ctx: Parameters<typeof maybe>[0]) => {const user=await maybe(ctx); if(!user)throw new Error('Unauthenticated');return user;}};
});
const modules = import.meta.glob('/src/**/*.*s');
const dateKey = '2027-01-29';
async function fixture() {
  const t=convexTest(schema,modules);
  const users=await t.run(async ctx => {
    const result: Doc<'users'>[]=[];
    for(const [uniqueId, gradeLevel, major, minor] of [['ADMIN',null,null,null],['ENG9',9,'ENGINEERING',null],['ENG10',10,'ENGINEERING',null],['IT9',9,'INFORMATION_TECHNOLOGY',null],['MINOR9',9,'INFORMATION_TECHNOLOGY','ENGINEERING']] as const){
      const admin=uniqueId==='ADMIN';
      const id=await ctx.db.insert('users',{uniqueId,firstName:uniqueId,lastName:'Test',roles:admin?['ADMIN']:['STUDENT'],isStudent:!admin,isTeacherStaff:admin,isStudentAdmin:false,isOtherRole:false,isActive:true,mustResetPassword:false,dashboardLayout:[],searchText:uniqueId,createdAt:1,updatedAt:1,...(gradeLevel?{gradeLevel}:{}),...(major?{major}:{}),...(minor?{minor}:{})});
      result.push((await ctx.db.get(id))!);
    }
    return result;
  });
  auth.userId=users[0]._id;
  const regular=await t.mutation(api.schedule.dayPlans.saveTemplate,{name:'Regular',kind:'REGULAR',blocks:[{label:'Period 1',periodNumber:1,startTime:'08:55',endTime:'09:45'}]});
  const flex=await t.mutation(api.schedule.dayPlans.saveTemplate,{name:'Standard Flex',kind:'SPECIAL',blocks:[{label:'Workshop',periodNumber:null,startTime:'10:05',endTime:'12:05'}]});
  const freshman=await t.mutation(api.schedule.dayPlans.saveTemplate,{name:'Grade 9 Flex',kind:'SPECIAL',blocks:[{label:'Freshman 101',periodNumber:null,startTime:'10:00',endTime:'10:45'}]});
  await t.mutation(api.schedule.dayPlans.configureAcademicYear,{startDateKey:'2026-08-01',endDateKey:'2027-06-30',regularTemplateId:regular.id});
  await t.mutation(api.schedule.dayPlans.applyTemplateToDate,{dateKey,templateId:regular.id});
  const args={dateKey,pathway:'ENGINEERING' as const};
  const ninth=await t.mutation(api.schedule.dayPlans.applyScopedTemplateToDate,{...args,templateId:freshman.id,gradeLevels:[9]});
  await t.mutation(api.schedule.dayPlans.applyScopedTemplateToDate,{...args,templateId:flex.id,gradeLevels:[10,11,12]});
  return {t,users,regular,flex,freshman,ninth,args};
}
describe('scoped school-day plans',()=>{
  it('resolves the real dashboard by grade and major/minor, preserving other students and staff',async()=>{
    const {t,users}=await fixture();
    for(const [user,expected] of [[users[1],'Grade 9 Flex'],[users[2],'Standard Flex'],[users[3],'Regular'],[users[4],'Grade 9 Flex'],[users[0],'Regular']] as const){
      auth.userId=user._id;
      const result=await t.query(api.schedule.dashboard.getDay,{dateKey});
      expect(result.name).toBe(expected);
      expect(result.source).toBe('DATE_OVERRIDE');
    }
  });
  it('keeps school-wide closures above scoped plans',async()=>{
    const {t,users}=await fixture();
    const closed=await t.mutation(api.schedule.dayPlans.saveTemplate,{name:'No school',kind:'NO_SCHOOL',blocks:[]});
    await t.mutation(api.schedule.dayPlans.applyTemplateToDate,{dateKey,templateId:closed.id});
    const result=await t.run(ctx=>loadDayPlanSource(ctx,dateKey,users[1]));
    expect(result.name).toBe('No school');expect(result.blocks).toEqual([]);
  });
  it('rejects overlapping scopes, invalid grades, weekends and out-of-year assignments',async()=>{
    const {t,args,flex}=await fixture();
    for(const change of [{gradeLevels:[9],pathway:'HEALTH_SCIENCE' as const},{gradeLevels:[8]},{gradeLevels:[9.5]},{gradeLevels:[9],dateKey:'2027-01-30'},{gradeLevels:[9],dateKey:'2028-01-29'}]){
      await expect(t.mutation(api.schedule.dayPlans.applyScopedTemplateToDate,{...args,templateId:flex.id,...change})).rejects.toThrow();
    }
  });
  it('requires admin access and does not allow students or anonymous users to assign or remove',async()=>{
    const {t,users,args,flex,ninth}=await fixture();
    for(const id of [users[1]._id,null]){
      auth.userId=id;
      await expect(t.mutation(api.schedule.dayPlans.applyScopedTemplateToDate,{...args,gradeLevels:[9],templateId:flex.id})).rejects.toThrow();
      await expect(t.mutation(api.schedule.dayPlans.removeScopedAssignment,{assignmentId:ninth})).rejects.toThrow();
    }
  });
  it('updates an existing scope once, follows template edits, protects referenced templates, and removes cleanly',async()=>{
    const {t,args,freshman,ninth,users}=await fixture();
    expect(await t.mutation(api.schedule.dayPlans.applyScopedTemplateToDate,{...args,templateId:freshman.id,gradeLevels:[9]})).toBe(ninth);
    const workspace=await t.query(api.schedule.dayPlans.getAdminWorkspace,{dateKey});
    expect(workspace.scopedAssignments).toHaveLength(2);
    await expect(t.mutation(api.schedule.dayPlans.deleteTemplate,{templateId:freshman.id})).rejects.toThrow();
    await t.mutation(api.schedule.dayPlans.saveTemplate,{templateId:freshman.id,name:freshman.name,kind:'SPECIAL',blocks:[{label:'Updated block',periodNumber:null,startTime:'09:00',endTime:'10:00'}]});
    expect((await t.run(ctx=>loadDayPlanSource(ctx,dateKey,users[1]))).blocks[0].label).toBe('Updated block');
    await t.mutation(api.schedule.dayPlans.removeScopedAssignment,{assignmentId:ninth});
    expect((await t.run(ctx=>loadDayPlanSource(ctx,dateKey,users[1]))).name).toBe('Regular');
  });
});
