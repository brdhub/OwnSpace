import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { generateResumeDocx } from '../../src/features/resumes/documents/docx';
import type { ResumeDocument } from '../../src/features/resumes/documents/model';

test('Word output contains visible editable text and safe links but no hidden sections or JD', async () => {
  const item={id:'i1',title:'接口服务',organization:'',role:'开发',dateRange:'2025',link:'https://example.com/project',body:'完成接口测试\n支持中文与 <特殊> 字符',hidden:false,sourceEntryId:1,sourceSuggestionId:null};
  const document:ResumeDocument={schemaVersion:1,templateVersion:'classic-v1',targetRole:'后端开发',jdText:'不可导出的 JD',profile:{name:'张同学',email:'test@example.com',phone:'',city:'杭州',link:''},sections:[{id:'s1',type:'project',title:'项目经历',hidden:false,items:[item,{...item,id:'i2',hidden:true,title:'隐藏内容'}]},{id:'s2',type:'skill',title:'隐藏分区',hidden:true,items:[{...item,id:'i3'}]}]};
  const zip=await JSZip.loadAsync(await generateResumeDocx(document));
  const xml=await zip.file('word/document.xml')!.async('string');
  assert.match(xml,/张同学/);assert.match(xml,/完成接口测试/);assert.match(xml,/&lt;特殊&gt;/);
  assert.doesNotMatch(xml,/隐藏内容|隐藏分区|不可导出的 JD/);
  const relationships=await zip.file('word/_rels/document.xml.rels')!.async('string');
  assert.match(relationships,/https:\/\/example.com\/project/);
});
