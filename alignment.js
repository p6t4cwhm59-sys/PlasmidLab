(function(){
  'use strict';

  const ALIGN_STATE={reads:[],results:[],selected:0,selectedVariant:0};
  const ALIGN_SCORE={match:1,mismatch:-2,gap:-3,gapOpen:-3,gapExtend:-1};
  const CODON_TABLE={
    TTT:'F',TTC:'F',TTA:'L',TTG:'L',TCT:'S',TCC:'S',TCA:'S',TCG:'S',
    TAT:'Y',TAC:'Y',TAA:'*',TAG:'*',TGT:'C',TGC:'C',TGA:'*',TGG:'W',
    CTT:'L',CTC:'L',CTA:'L',CTG:'L',CCT:'P',CCC:'P',CCA:'P',CCG:'P',
    CAT:'H',CAC:'H',CAA:'Q',CAG:'Q',CGT:'R',CGC:'R',CGA:'R',CGG:'R',
    ATT:'I',ATC:'I',ATA:'I',ATG:'M',ACT:'T',ACC:'T',ACA:'T',ACG:'T',
    AAT:'N',AAC:'N',AAA:'K',AAG:'K',AGT:'S',AGC:'S',AGA:'R',AGG:'R',
    GTT:'V',GTC:'V',GTA:'V',GTG:'V',GCT:'A',GCC:'A',GCA:'A',GCG:'A',
    GAT:'D',GAC:'D',GAA:'E',GAG:'E',GGT:'G',GGC:'G',GGA:'G',GGG:'G'
  };

  function $(id){ return document.getElementById(id); }
  function esc(value){ return String(value==null?'':value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function safeName(file){ return String(file&&file.name||'Sanger read').replace(/\.[^.]+$/,''); }
  function avg(values){ return values&&values.length ? values.reduce((a,b)=>a+b,0)/values.length : 0; }
  function dna(s){ try{ if(typeof cleanDNA==='function') return cleanDNA(s||''); }catch(e){} return String(s||'').toUpperCase().replace(/U/g,'T').replace(/[^ACGTRYSWKMBDHVN]/g,''); }
  function baseAt(seq,pos){ return seq[(pos-1+seq.length)%seq.length]||'N'; }
  function compBase(b){ return ({A:'T',T:'A',G:'C',C:'G',R:'Y',Y:'R',S:'S',W:'W',K:'M',M:'K',B:'V',D:'H',H:'D',V:'B',N:'N','-':'-'})[String(b||'N').toUpperCase()]||'N'; }
  function rcSeq(seq){ return dna(seq).split('').reverse().map(compBase).join(''); }
  function exactBase(b){ return /^[ACGT]$/.test(String(b||'')); }
  function translateCodon(codon){ return CODON_TABLE[dna(codon).slice(0,3)]||'X'; }
  function shortText(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }
  function safeColor(c){ c=String(c||'').trim(); return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c)?c:'#ffd166'; }
  function currentPlasmid(){
    try{ if(typeof cur==='function') return cur(); }catch(e){}
    try{ if(typeof plasmids!=='undefined' && typeof active!=='undefined') return plasmids[active]||null; }catch(e){}
    return null;
  }
  function downloadFile(name,text,mime){
    try{ if(typeof download==='function') return download(name,text,mime||'text/plain;charset=utf-8'); }catch(e){}
    const blob=new Blob([text],{type:mime||'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},600);
  }

  function installCss(){
    if($('plasmidlab-alignment-css')) return;
    const style=document.createElement('style');
    style.id='plasmidlab-alignment-css';
    style.textContent=`
      .alignPanel{border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow);overflow:hidden}
      .alignHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#f8fbff,#eef8ff)}
      .alignHead h2{margin:0 0 4px 0;font-size:17px;color:#22324a}
      .alignHeadActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .alignBody{padding:14px 16px}
      .alignDrop{border:1px dashed #9bb8f7;border-radius:14px;background:#f8fbff;padding:12px;margin-bottom:10px}
      .alignControls{display:grid;grid-template-columns:1.5fr .72fr .72fr .72fr;gap:8px;align-items:end}
      .alignControls label{font-size:12px;color:var(--muted)}
      .alignControls input,.alignControls select{margin-top:4px}
      .alignLayerToggles{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
      .alignLayerToggles label{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 9px;font-size:12px;color:#334155}
      .alignReadList{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .alignReadChip{border:1px solid var(--line);border-radius:999px;background:#fff;padding:7px 10px;cursor:pointer}
      .alignReadChip.active{background:var(--pri);border-color:var(--pri);color:#fff}
      .alignStats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}
      .alignStat{border:1px solid var(--line);border-radius:12px;background:#fbfcff;padding:10px}
      .alignStat b{font-size:16px;color:#1f2937}
      .alignHelp{background:#eef6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px;color:#1e3a8a;line-height:1.5}
      .alignOverviewBox,.alignBox,.alignDetail{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
      .alignBox h3,.alignOverviewBox h3,.alignDetail h3{margin:0;padding:10px 12px;font-size:14px;background:#f8fafc;border-bottom:1px solid var(--line)}
      .alignOverviewInner{padding:12px}
      .alignOverviewTrack{position:relative;height:86px;border:1px solid #dbe4f0;border-radius:12px;background:linear-gradient(180deg,#fbfdff,#f4f8ff);overflow:hidden}
      .ovCoverage{position:absolute;top:6px;height:74px;background:rgba(47,111,237,.08);border:1px solid rgba(47,111,237,.22);border-radius:8px}
      .ovFeature{position:absolute;top:12px;height:20px;border-radius:999px;opacity:.55;border:1px solid rgba(15,23,42,.18)}
      .ovFeature span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;color:#0f172a;padding:2px 5px}
      .ovMarker{position:absolute;bottom:12px;width:13px;height:30px;transform:translateX(-50%);border:0;background:transparent;cursor:pointer;padding:0}
      .ovMarker:before{content:"";position:absolute;left:4px;top:0;width:5px;height:22px;border-radius:6px;background:#ef4444;box-shadow:0 0 0 2px rgba(255,255,255,.9)}
      .ovMarker:after{content:"";position:absolute;left:1px;bottom:0;width:11px;height:11px;border-radius:999px;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.25)}
      .ovMarker.ins:before,.ovMarker.ins:after{background:#2563eb}
      .ovMarker.del:before,.ovMarker.del:after{background:#f59e0b}
      .ovMarker.ambiguous:before,.ovMarker.ambiguous:after{background:#7c3aed}
      .ovMarker.active:after{outline:3px solid rgba(47,111,237,.32)}
      .alignLegend{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:12px;color:#475569}
      .legendDot{display:inline-block;width:10px;height:10px;border-radius:999px;margin-right:4px;vertical-align:-1px}
      .legendDot.mis{background:#ef4444}.legendDot.ins{background:#2563eb}.legendDot.del{background:#f59e0b}.legendDot.feat{background:#9cf5d0}
      .alignWorkspace{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px;margin-top:12px}
      .alignCanvasShell{min-width:0}
      .alignToolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--line);background:#fbfcff}
      .alignScroll{overflow:auto;max-height:62vh;background:#fffaf0;position:relative}
      .alignCanvas{display:inline-block;min-width:100%;padding:12px 14px 16px 0;font-family:var(--mono);font-size:12px;line-height:1.35}
      .alnRow{display:flex;min-height:18px;align-items:stretch;white-space:nowrap}
      .alnRow+.alnRow{margin-top:1px}
      .alnLabel{position:sticky;left:0;z-index:4;display:inline-flex;align-items:center;justify-content:flex-end;width:76px;min-width:76px;padding-right:8px;background:#fffaf0;color:#64748b;font-family:var(--mono);font-size:11px;border-right:1px solid #eadfcb}
      .alnCells{display:inline-flex;align-items:stretch}
      .alnCell{position:relative;display:inline-flex;align-items:center;justify-content:center;width:13px;min-width:13px;height:18px;box-sizing:border-box;border-radius:2px;color:#111827;text-decoration:none;cursor:default}
      .alnCell[data-align-var]{cursor:pointer}
      .alnRuler .alnCell{height:22px;color:#64748b;font-size:10px;overflow:visible}
      .alnRuler .tick:after{content:"";position:absolute;left:50%;bottom:0;width:1px;height:5px;background:#94a3b8}
      .alnFeatureCell,.alnPrimerCell,.alnEnzymeCell,.alnAaCell{height:18px;font-size:10px;color:#0f172a;overflow:visible}
      .alnFeatureCell.hasFeature,.alnPrimerCell.hasPrimer,.alnEnzymeCell.hasEnzyme{border-left:1px solid rgba(15,23,42,.12);border-right:1px solid rgba(15,23,42,.04)}
      .alnFeatureCell[data-label]:not([data-label=""]):after,.alnPrimerCell[data-label]:not([data-label=""]):after,.alnEnzymeCell[data-label]:not([data-label=""]):after{
        content:attr(data-label);position:absolute;left:1px;top:1px;z-index:3;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,.78);border-radius:3px;padding:0 3px;color:#0f172a
      }
      .alnAaCell.coding{background:#ecfccb;color:#365314}
      .alnAaCell.aaChanged{background:#fecaca;color:#991b1b;font-weight:700}
      .alnRefBase,.alnReadBase{font-size:13px}
      .alnMid{color:#64748b}
      .alnMatch{color:#111827}
      .alnMismatch{background:#ffd6d6;color:#9b1c1c;font-weight:700}
      .alnIns{background:#dbeafe;color:#1d4ed8;font-weight:700}
      .alnDel{background:#fee2b3;color:#92400e;font-weight:700}
      .alnAmbiguous{background:#ede9fe;color:#6d28d9;font-weight:700}
      .alnLow{box-shadow:inset 0 -2px 0 #b45309}
      .alnSelected{outline:2px solid #2563eb;z-index:2}
      .alnGap{color:#94a3b8}
      .alignSide{min-width:0}
      .alignVariantTable{max-height:62vh;overflow:auto}
      .alignVariantTable table{font-size:12px;width:100%;border-collapse:collapse}
      .alignVariantTable th{position:sticky;top:0;background:#f8fafc;z-index:2}
      .alignVariantTable tr{cursor:pointer}
      .alignVariantTable tr.active{background:#e8f0ff}
      .alignVariantTable .strongVar{color:#991b1b;font-weight:700}
      .alignVariantTable .weakVar{color:#92400e}
      .alignVariantTable .typeMismatch{color:#dc2626;font-weight:700}
      .alignVariantTable .typeIns{color:#2563eb;font-weight:700}
      .alignVariantTable .typeDel{color:#b45309;font-weight:700}
      .alignDetail{margin-top:12px}
      .alignDetailBody{padding:12px;display:grid;grid-template-columns:260px 1fr;gap:12px}
      .verdictCard{border-radius:12px;padding:12px;border:1px solid #dbe4f0;background:#f8fafc}
      .verdictCard.pass{background:#ecfdf5;border-color:#bbf7d0;color:#14532d}
      .verdictCard.warn{background:#fff7ed;border-color:#fed7aa;color:#7c2d12}
      .verdictCard.fail{background:#fef2f2;border-color:#fecaca;color:#7f1d1d}
      .verdictCard b{font-size:16px}
      .detailList{margin:0;padding-left:18px;line-height:1.65}
      .contextPills{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .contextPill{display:inline-flex;border:1px solid #dbe4f0;border-radius:999px;background:#fff;padding:4px 8px;font-size:12px;color:#334155}
      @media(max-width:1100px){.alignWorkspace{grid-template-columns:1fr}.alignVariantTable{max-height:320px}.alignDetailBody{grid-template-columns:1fr}}
      @media(max-width:900px){.alignControls{grid-template-columns:1fr 1fr}.alignHead{display:block}.alignHeadActions{margin-top:10px}.alignCanvas{font-size:11px}.alnCell{width:12px;min-width:12px}.alnLabel{width:66px;min-width:66px}}
      @media(max-width:520px){.alignControls{grid-template-columns:1fr}.alignBody{padding:10px}.alignScroll{max-height:58vh}.alnCell{width:11px;min-width:11px}.alnRefBase,.alnReadBase{font-size:12px}.alnLabel{width:58px;min-width:58px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  function installUi(){
    installCss();
    if($('alignView')) return;
    const switcher=document.querySelector('.viewSwitch');
    if(switcher&&!$('alignViewBtn')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.id='alignViewBtn';
      btn.dataset.view='align';
      btn.textContent='测序比对';
      switcher.insertBefore(btn,switcher.querySelector('[data-view="tools"]')||null);
      btn.onclick=()=>showAlignmentView();
    }
    const main=document.querySelector('.mainGrid');
    const tools=$('toolsView');
    const host=document.createElement('div');
    host.id='alignView';
    host.className='hidden';
    host.innerHTML=`
      <div class="alignPanel">
        <div class="alignHead">
          <div>
            <h2>Sanger 测序比对与构建验证（.ab1 / .abi）</h2>
            <div class="small">参考序列、测序 read、差异概览、feature/CDS/tag/linker/同源臂语境联动显示，用于判断克隆是否值得保留。</div>
          </div>
          <div class="alignHeadActions">
            <button type="button" id="alignClearBtn">清空比对结果</button>
          </div>
        </div>
        <div class="alignBody">
          <div class="alignHelp">
            原则：每条 .ab1 read 独立比对到当前质粒参考序列；自动裁剪低质量两端、自动判断正反向互补。高质量 mismatch / insertion / deletion 会进入构建判断；低质量差异作为疑点提醒复测。
          </div>
          <div class="alignDrop mt">
            <div class="alignControls">
              <label>选择测序文件（iPhone/iPad 可直接选 .ab1）
                <input id="alignFileInput" type="file" multiple>
              </label>
              <label>质量阈值
                <select id="alignQCut">
                  <option value="15">Phred 15</option>
                  <option value="20" selected>Phred 20</option>
                  <option value="25">Phred 25</option>
                  <option value="30">Phred 30</option>
                </select>
              </label>
              <label>裁剪窗口
                <select id="alignWindow">
                  <option value="12">12 bp</option>
                  <option value="20" selected>20 bp</option>
                  <option value="30">30 bp</option>
                </select>
              </label>
              <label>最低比对长度
                <select id="alignMinLen">
                  <option value="30">30 bp</option>
                  <option value="40" selected>40 bp</option>
                  <option value="80">80 bp</option>
                </select>
              </label>
            </div>
            <div class="alignLayerToggles">
              <label><input type="checkbox" id="alignShowAa" checked> 氨基酸翻译层</label>
              <label><input type="checkbox" id="alignShowFeatures" checked> Feature 注释层</label>
              <label><input type="checkbox" id="alignShowPrimers" checked> 引物/同源臂层</label>
              <label><input type="checkbox" id="alignShowEnzymes" checked> 酶切位点层</label>
            </div>
            <div class="row mt">
              <button type="button" class="primary" id="alignRunBtn">导入 .ab1 并比对当前质粒</button>
              <button type="button" id="alignExportBtn">导出比对报告 TSV</button>
            </div>
          </div>
          <div id="alignStatus" class="status hidden"></div>
          <div id="alignReadList" class="alignReadList"></div>
          <div id="alignSummary"></div>
          <div id="alignOutput"></div>
        </div>
      </div>
    `;
    if(main){
      if(tools && tools.parentNode===main) main.insertBefore(host,tools);
      else main.appendChild(host);
    }
    $('alignRunBtn').onclick=()=>runSelectedAlignmentFiles();
    $('alignFileInput').onchange=()=>runSelectedAlignmentFiles();
    $('alignClearBtn').onclick=()=>{ALIGN_STATE.reads=[];ALIGN_STATE.results=[];ALIGN_STATE.selected=0;ALIGN_STATE.selectedVariant=0;renderAlignmentResults();setAlignStatus('已清空测序比对结果。');};
    $('alignExportBtn').onclick=exportAlignmentReport;
    ['alignShowAa','alignShowFeatures','alignShowPrimers','alignShowEnzymes'].forEach(id=>{ const el=$(id); if(el) el.onchange=()=>renderAlignmentResults(); });
    patchShowView();
  }

  function patchShowView(){
    if(window.__plabAlignmentShowViewPatched) return;
    window.__plabAlignmentShowViewPatched=true;
    const oldShow=typeof showView==='function'?showView:null;
    try{
      showView=function(v){
        if(v==='align') return showAlignmentView();
        if($('alignView')) $('alignView').classList.add('hidden');
        document.querySelector('[data-view="align"]')?.classList.remove('active');
        if(oldShow) return oldShow(v);
      };
      window.showView=showView;
    }catch(e){}
  }

  function showAlignmentView(){
    ['map','seq','features','enzymes','primers','tools'].forEach(v=>{
      const el=$(v+'View'); if(el) el.classList.add('hidden');
      document.querySelector(`[data-view="${v}"]`)?.classList.remove('active');
    });
    $('alignView')?.classList.remove('hidden');
    document.querySelector('[data-view="align"]')?.classList.add('active');
    try{currentView='align';}catch(e){}
    renderAlignmentResults();
  }

  function setAlignStatus(text,kind){
    const el=$('alignStatus');
    if(!el) return;
    el.textContent=text;
    el.classList.remove('hidden');
    el.classList.toggle('warn',kind==='warn');
    el.classList.toggle('ok',kind==='ok');
  }

  function readAbifDirectory(buffer){
    const bytes=new Uint8Array(buffer);
    const view=new DataView(buffer);
    const ascii=new TextDecoder('ascii');
    function text(offset,length){ return ascii.decode(bytes.subarray(offset,offset+length)).replace(/\0+$/g,''); }
    if(text(0,4)!=='ABIF') throw new Error('不是 ABI/ABIF 格式文件');
    function dir(offset){
      return {
        name:text(offset,4),
        number:view.getInt32(offset+4,false),
        type:view.getInt16(offset+8,false),
        elementSize:view.getInt16(offset+10,false),
        elementCount:view.getInt32(offset+12,false),
        dataSize:view.getInt32(offset+16,false),
        dataOffset:view.getInt32(offset+20,false),
        inlineOffset:offset+20
      };
    }
    const root=dir(6);
    const dirs=[];
    for(let i=0;i<root.elementCount;i++) dirs.push(dir(root.dataOffset+i*28));
    function tag(name,number){ return dirs.find(d=>d.name===name&&d.number===number); }
    function tagBytes(t){ const o=t.dataSize<=4?t.inlineOffset:t.dataOffset; return bytes.subarray(o,o+t.dataSize); }
    function tagInts(t){
      const b=tagBytes(t), dv=new DataView(b.buffer,b.byteOffset,b.byteLength), out=[];
      const size=t.elementSize||({1:1,2:1,3:2,4:2,5:4,7:4,8:4,10:1,11:1,12:2,13:4,14:4,15:4,18:1,19:1}[t.type]||1);
      for(let i=0;i<t.elementCount;i++){
        const o=i*size;
        if(size===1) out.push(b[o]||0);
        else if(size===2) out.push(dv.getInt16(o,false));
        else out.push(dv.getInt32(o,false));
      }
      return out;
    }
    return {bytes,ascii,dirs,tag,tagBytes,tagInts};
  }

  function parseAbiRead(buffer,name){
    const abif=readAbifDirectory(buffer);
    const baseTag=abif.tag('PBAS',2)||abif.tag('PBAS',1);
    if(!baseTag) throw new Error('AB1 中没有 PBAS base calls');
    const seq=abif.ascii.decode(abif.tagBytes(baseTag)).replace(/[^A-Za-z]/g,'').toUpperCase().replace(/U/g,'T').replace(/[^ACGTRYSWKMBDHVN]/g,'N');
    const qTag=abif.tag('PCON',2)||abif.tag('PCON',1);
    const pTag=abif.tag('PLOC',2)||abif.tag('PLOC',1);
    const orderTag=abif.tag('FWO_',1);
    const quality=qTag?[...abif.tagBytes(qTag)]:[];
    const peakLocations=pTag?abif.tagInts(pTag):[];
    const channelOrder=orderTag?abif.ascii.decode(abif.tagBytes(orderTag)).replace(/\0/g,''):'';
    const traces=[9,10,11,12].map(n=>{
      const t=abif.tag('DATA',n);
      return t?abif.tagInts(t):[];
    });
    if(!seq || seq.length<10) throw new Error('AB1 base calls 过短或无法识别');
    return {name:name||'Sanger read',seq,quality,peakLocations,channelOrder,traces,rawLength:seq.length};
  }

  function trimByQuality(read,cutoff,windowSize){
    const seq=read.seq||'', q=read.quality||[];
    if(!q.length || q.length!==seq.length) return {...read,trimStart:0,trimEnd:seq.length,trimmedSeq:seq,trimmedQuality:q.slice(),trimNote:'无质量值，未自动裁剪'};
    const n=seq.length, w=Math.max(5,Math.min(windowSize||20,n));
    function goodWindow(start){
      let sum=0, bad=0, nCount=0;
      for(let i=start;i<Math.min(n,start+w);i++){
        sum+=q[i]||0;
        if((q[i]||0)<cutoff) bad++;
        if(seq[i]==='N') nCount++;
      }
      const len=Math.min(n,start+w)-start;
      return len>=Math.min(w,n-start) && sum/len>=cutoff && bad/len<=0.35 && nCount/len<=0.25;
    }
    let left=0;
    while(left<n-w && !goodWindow(left)) left++;
    let right=n;
    while(right-w>left && !goodWindow(right-w)) right--;
    if(right-left<30){ left=0; right=n; }
    return {
      ...read,
      trimStart:left,
      trimEnd:right,
      trimmedSeq:seq.slice(left,right),
      trimmedQuality:q.slice(left,right),
      trimNote:`隐藏 5' ${left} bp，3' ${n-right} bp`
    };
  }

  function scorePair(a,b){
    if(!a||!b) return ALIGN_SCORE.mismatch;
    if(a===b && exactBase(a)) return ALIGN_SCORE.match;
    if(a==='N'||b==='N') return -1;
    return ALIGN_SCORE.mismatch;
  }

  function smithWaterman(readSeq,refSeq,refLen){
    const n=readSeq.length, m=refSeq.length;
    const total=(n+1)*(m+1);
    const M=new Int32Array(total); // base-to-base
    const D=new Int32Array(total); // gap in read: reference deletion relative to sample
    const I=new Int32Array(total); // gap in reference: insertion in sample
    const gapOpen=ALIGN_SCORE.gapOpen==null?ALIGN_SCORE.gap:ALIGN_SCORE.gapOpen;
    const gapExtend=ALIGN_SCORE.gapExtend==null?ALIGN_SCORE.gap:ALIGN_SCORE.gapExtend;
    let best=0,bestI=0,bestJ=0,bestState=0;
    const idx=(i,j)=>i*(m+1)+j;
    for(let i=1;i<=n;i++){
      const rb=readSeq[i-1];
      for(let j=1;j<=m;j++){
        const here=idx(i,j);
        const diag=idx(i-1,j-1);
        const left=idx(i,j-1);
        const up=idx(i-1,j);
        const prevBest=Math.max(M[diag],D[diag],I[diag],0);
        M[here]=Math.max(0,prevBest+scorePair(rb,refSeq[j-1]));
        D[here]=Math.max(0,M[left]+gapOpen,D[left]+gapExtend,I[left]+gapOpen);
        I[here]=Math.max(0,M[up]+gapOpen,I[up]+gapExtend,D[up]+gapOpen);
        if(M[here]>best){ best=M[here]; bestI=i; bestJ=j; bestState=0; }
        if(D[here]>best){ best=D[here]; bestI=i; bestJ=j; bestState=1; }
        if(I[here]>best){ best=I[here]; bestI=i; bestJ=j; bestState=2; }
      }
    }
    let i=bestI,j=bestJ;
    let state=bestState;
    const refAln=[],readAln=[],refIdx=[],readIdx=[];
    while(i>0&&j>0){
      const here=idx(i,j);
      if(state===0){
        const score=M[here];
        if(score<=0) break;
        const s=scorePair(readSeq[i-1],refSeq[j-1]);
        const prev=idx(i-1,j-1);
        const target=score-s;
        refAln.push(refSeq[j-1]); readAln.push(readSeq[i-1]); refIdx.push(j); readIdx.push(i);
        i--; j--;
        if(target<=0) break;
        if(D[prev]===target) state=1;
        else if(I[prev]===target) state=2;
        else state=0;
      }else if(state===1){
        const score=D[here];
        if(score<=0) break;
        const left=idx(i,j-1);
        refAln.push(refSeq[j-1]); readAln.push('-'); refIdx.push(j); readIdx.push(null);
        if(D[left]+gapExtend===score){ j--; state=1; }
        else if(I[left]+gapOpen===score){ j--; state=2; }
        else if(M[left]+gapOpen===score){ j--; state=0; }
        else break;
      }else{
        const score=I[here];
        if(score<=0) break;
        const up=idx(i-1,j);
        refAln.push('-'); readAln.push(readSeq[i-1]); refIdx.push(null); readIdx.push(i);
        if(I[up]+gapExtend===score){ i--; state=2; }
        else if(D[up]+gapOpen===score){ i--; state=1; }
        else if(M[up]+gapOpen===score){ i--; state=0; }
        else break;
      }
    }
    refAln.reverse(); readAln.reverse(); refIdx.reverse(); readIdx.reverse();
    let matches=0,mismatches=0,gaps=0,alignedBases=0;
    for(let k=0;k<refAln.length;k++){
      const r=refAln[k], q=readAln[k];
      if(r==='-'||q==='-'){ gaps++; continue; }
      alignedBases++;
      if(r===q && exactBase(r)) matches++; else mismatches++;
    }
    const mapped=refIdx.filter(v=>v!=null).map(v=>((v-1)%refLen)+1);
    return {
      score:best,
      refAln:refAln.join(''),
      readAln:readAln.join(''),
      refIdx,readIdx,
      matches,mismatches,gaps,alignedBases,
      identity:alignedBases?matches/alignedBases:0,
      refStart:mapped.length?mapped[0]:null,
      refEnd:mapped.length?mapped[mapped.length-1]:null,
      readStart:i+1,
      readEnd:bestI
    };
  }

  function cloneReference(plasmid){
    const seq=dna(plasmid.seq);
    const copy=part=>JSON.parse(JSON.stringify(part||[]));
    return {
      name:plasmid.name||'Reference',
      seq,
      circular:plasmid.circular!==false,
      features:copy(plasmid.features),
      primers:copy(plasmid.primers),
      enzymes:copy(plasmid.enzymes)
    };
  }

  function alignOneRead(read,plasmid,options){
    const reference=cloneReference(plasmid);
    const cutoff=parseInt(options.cutoff)||20;
    const windowSize=parseInt(options.windowSize)||20;
    const minLen=parseInt(options.minLen)||40;
    const trimmed=trimByQuality(read,cutoff,windowSize);
    if(trimmed.trimmedSeq.length<minLen) throw new Error(`${read.name}: 质量裁剪后长度 ${trimmed.trimmedSeq.length} bp，小于最低 ${minLen} bp`);
    const ref=reference.seq;
    const ext=reference.circular ? ref+ref.slice(0,Math.min(ref.length,trimmed.trimmedSeq.length+80)) : ref;
    const fwd=smithWaterman(trimmed.trimmedSeq,ext,ref.length);
    const revSeq=rcSeq(trimmed.trimmedSeq);
    const revQual=(trimmed.trimmedQuality||[]).slice().reverse();
    const rev=smithWaterman(revSeq,ext,ref.length);
    const chosen=(rev.score>fwd.score)?rev:fwd;
    const orientation=(rev.score>fwd.score)?'-':'+';
    const orientedQuality=orientation==='-'?revQual:(trimmed.trimmedQuality||[]);
    const result={read,trimmed,alignment:chosen,orientation,reference,options:{cutoff,windowSize,minLen}};
    result.variants=callVariants(chosen,orientedQuality,reference);
    result.aaImpacts=result.variants.flatMap(v=>v.impacts||[]).filter(Boolean);
    result.summary=recommendClone(result,reference);
    return result;
  }

  function callVariants(aln,quality,plasmid){
    const raw=[];
    let lastRef=null;
    for(let k=0;k<aln.refAln.length;k++){
      const rb=aln.refAln[k], qb=aln.readAln[k];
      const refRaw=aln.refIdx[k];
      const refPos=refRaw==null?null:((refRaw-1)%plasmid.seq.length)+1;
      const readPos=aln.readIdx[k];
      if(refPos!=null) lastRef=refPos;
      if(rb==='-'&&qb!=='-'){
        const q=readPos?quality[readPos-1]:null;
        raw.push({type:'ins',alnIndex:k,alnEndIndex:k,pos:lastRef,end:lastRef,ref:'-',read:qb,readPos,quality:q,qualities:q==null?[]:[q],confidence:confidence(q),length:1,label:`${lastRef} 后插入 ${qb}`});
      }else if(rb!=='-'&&qb==='-'){
        raw.push({type:'del',alnIndex:k,alnEndIndex:k,pos:refPos,end:refPos,ref:rb,read:'-',readPos:null,quality:null,qualities:[],confidence:'strong',length:1,label:`${refPos} 删除 ${rb}`});
      }else if(rb!==qb){
        const q=readPos?quality[readPos-1]:null;
        const type=qb==='N'?'ambiguous':'mismatch';
        raw.push({type,alnIndex:k,alnEndIndex:k,pos:refPos,end:refPos,ref:rb,read:qb,readPos,quality:q,qualities:q==null?[]:[q],confidence:confidence(q),length:1,label:`${refPos} ${rb}→${qb}`});
      }
    }
    const out=groupGapVariants(raw,plasmid);
    annotateVariants(out,plasmid);
    return out;
  }

  function groupGapVariants(raw,plasmid){
    const out=[];
    for(let i=0;i<raw.length;i++){
      const first=raw[i];
      if(first.type!=='del'&&first.type!=='ins'){
        out.push(first);
        continue;
      }
      const run=[first];
      while(i+1<raw.length && canMergeGap(run[run.length-1],raw[i+1],plasmid)){
        run.push(raw[++i]);
      }
      out.push(mergeGapRun(run,plasmid));
    }
    return out;
  }

  function canMergeGap(a,b,plasmid){
    if(!a||!b||a.type!==b.type) return false;
    if(a.type!=='del'&&a.type!=='ins') return false;
    if((b.alnIndex||0)!==(a.alnEndIndex||a.alnIndex)+1) return false;
    if(a.type==='ins') return a.pos===b.pos;
    return refNext(a.end,a.length,b.pos,plasmid.seq.length);
  }

  function refNext(prevPos,prevLen,nextPos,n){
    if(!prevPos||!nextPos||!n) return false;
    return ((prevPos-1+1)%n)+1===nextPos;
  }

  function mergeGapRun(run,plasmid){
    if(run.length===1) return run[0];
    const first=run[0], last=run[run.length-1];
    if(first.type==='del'){
      const ref=run.map(x=>x.ref).join('');
      return {...first,alnEndIndex:last.alnIndex,end:last.pos,ref,read:'-',length:ref.length,label:`${first.pos}${first.pos!==last.pos?'..'+last.pos:''} 删除 ${ref}`};
    }
    const read=run.map(x=>x.read).join('');
    const qs=run.flatMap(x=>x.qualities||[]);
    const q=qs.length?Math.round(avg(qs)):null;
    return {...first,alnEndIndex:last.alnIndex,end:first.pos,ref:'-',read,readPos:first.readPos,quality:q,qualities:qs,confidence:confidence(q),length:read.length,label:`${first.pos} 后插入 ${read}`};
  }

  function annotateVariants(out,plasmid){
    out.forEach(v=>{
      v.features=featuresAtPosition(plasmid,v.pos).map(featureDigest);
      v.primers=primersAtPosition(plasmid,v.pos).map(primerDigest);
      v.enzymes=enzymesAtPosition(plasmid,v.pos).map(e=>e.name);
      v.impactDetails=variantImpactDetails(v,plasmid);
      v.impacts=v.impactDetails.map(x=>x.text);
      v.contexts=variantContexts(v,plasmid);
    });
  }

  function confidence(q){
    if(q==null) return 'unknown';
    if(q>=30) return 'strong';
    if(q>=20) return 'medium';
    return 'weak';
  }

  function rangeContains(start,end,pos,n){
    start=parseInt(start); end=parseInt(end); pos=parseInt(pos);
    if(!start||!end||!pos) return false;
    if(start<=end) return pos>=start&&pos<=end;
    return pos>=start||pos<=end;
  }

  function featureContains(f,pos,n){ return rangeContains(f.start,f.end,pos,n); }
  function featuresAtPosition(plasmid,pos){
    if(!plasmid||!pos) return [];
    const n=plasmid.seq.length;
    return (plasmid.features||[]).filter(f=>featureContains(f,pos,n)).sort((a,b)=>featurePriority(a)-featurePriority(b));
  }
  function featurePriority(f){
    const s=`${f.type||''} ${f.name||''}`.toLowerCase();
    if(/cds|coding/.test(s)||f.translate) return 1;
    if(/tag|标签|linker|连接肽|his|flag|ha|myc|gfp|rfp|egfp|mcherry/.test(s)) return 2;
    if(/homology|同源|arm|junction|连接处|insert|插入/.test(s)) return 3;
    if(/primer/.test(s)) return 4;
    return 8;
  }
  function featureDigest(f){ return {name:f.name||f.type||'Feature',type:f.type||'',start:f.start,end:f.end,strand:f.strand||'+',color:f.color||''}; }
  function primerDigest(p){ return {name:p.name||'Primer',start:p.start,end:p.end,strand:p.strand||'+'}; }

  function primersAtPosition(plasmid,pos){
    if(!plasmid||!pos) return [];
    const n=plasmid.seq.length;
    return (plasmid.primers||[]).filter(pr=>rangeContains(pr.start,pr.end,pos,n));
  }

  function enzymesAtPosition(plasmid,pos){
    if(!plasmid||!pos) return [];
    const n=plasmid.seq.length;
    return (plasmid.enzymes||[]).filter(e=>e.count>0&&e.count<=4).filter(e=>{
      const len=String(e.site||'').length;
      return (e.positions||[]).some(st=>rangeContains(st,((st+len-2)%n)+1,pos,n));
    }).slice(0,4);
  }

  function featurePositions(plasmid,f){
    const n=plasmid.seq.length, s=parseInt(f.start), e=parseInt(f.end);
    const arr=[];
    if(!s||!e) return arr;
    if(s<=e){ for(let p=s;p<=e;p++) arr.push(p); }
    else{ for(let p=s;p<=n;p++) arr.push(p); for(let p=1;p<=e;p++) arr.push(p); }
    if((f.strand||'+')==='-') arr.reverse();
    return arr;
  }

  function codonForPositions(plasmid,positions,strand,mut){
    return positions.map(pos=>{
      let b=(mut&&Object.prototype.hasOwnProperty.call(mut,pos))?mut[pos]:baseAt(plasmid.seq,pos);
      return strand==='-'?compBase(b):b;
    }).join('');
  }

  function variantImpactDetails(v,plasmid){
    const impacts=[];
    const feats=(plasmid.features||[]).filter(f=>/CDS|coding/i.test(String(f.type||'')) || f.translate);
    feats.forEach(f=>{
      const positions=featurePositions(plasmid,f);
      const fname=f.name||'CDS';
      if(v.type==='ins'||v.type==='del'){
        const detail=indelImpactInFeature(v,plasmid,f,positions);
        if(detail) impacts.push(detail);
        return;
      }
      const idx=positions.indexOf(v.pos);
      if(idx<0) return;
      if(v.type!=='mismatch' || !exactBase(v.read)) return;
      const codonIndex=Math.floor(idx/3);
      const codonPos=positions.slice(codonIndex*3,codonIndex*3+3);
      if(codonPos.length<3) return;
      const mut={}; mut[v.pos]=v.read;
      const strand=f.strand||'+';
      const refCodon=codonForPositions(plasmid,codonPos,strand,null);
      const mutCodon=codonForPositions(plasmid,codonPos,strand,mut);
      const refAa=translateCodon(refCodon);
      const mutAa=translateCodon(mutCodon);
      const kind=refAa===mutAa?'沉默':(mutAa==='*'?'终止':'错义');
      const severity=kind==='沉默'?'low':(kind==='终止'?'high':'medium');
      impacts.push({featureName:fname,featureType:f.type||'CDS',aaIndex:codonIndex+1,refCodon,mutCodon,refAa,mutAa,kind,severity,text:`${fname} aa${codonIndex+1}: ${refCodon}(${refAa}) → ${mutCodon}(${mutAa})，${kind}`});
    });
    return impacts;
  }

  function indelImpactInFeature(v,plasmid,f,positions){
    const fname=f.name||'CDS';
    const strand=f.strand||'+';
    const len=(v.type==='del'?dna(v.ref).length:dna(v.read).length)||v.length||1;
    const inFrame=len%3===0;
    if(v.type==='del'){
      const affected=deletedPositionsForVariant(v,plasmid).map(pos=>positions.indexOf(pos)).filter(i=>i>=0).sort((a,b)=>a-b);
      if(!affected.length) return null;
      const contiguous=affected.every((idx,i)=>i===0||idx===affected[i-1]+1);
      const startsAtCodon=affected[0]%3===0;
      const deletedCoding=affected.map(idx=>{
        const b=baseAt(plasmid.seq,positions[idx]);
        return strand==='-'?compBase(b):b;
      }).join('');
      if(!inFrame){
        return {featureName:fname,featureType:f.type||'CDS',kind:'移码风险',severity:'high',text:`${fname}: 删除 ${len} bp（${v.ref}），会造成 frameshift 风险`};
      }
      if(contiguous&&startsAtCodon){
        const firstAa=Math.floor(affected[0]/3)+1;
        const codons=(deletedCoding.match(/.{1,3}/g)||[]).filter(x=>x.length===3);
        const aas=codons.map(translateCodon).join('');
        const aaRange=codons.length>1?`aa${firstAa}..${firstAa+codons.length-1}`:`aa${firstAa}`;
        const stopLost=aas.includes('*');
        return {
          featureName:fname,
          featureType:f.type||'CDS',
          aaIndex:firstAa,
          refCodon:codons.join(' '),
          mutCodon:'-',
          refAa:aas,
          mutAa:'Δ',
          kind:stopLost?'终止密码子缺失':'in-frame codon deletion',
          severity:stopLost?'high':'medium',
          text:`${fname} ${aaRange}: 删除 ${codons.join(' ')}(${aas})，in-frame codon deletion，不造成 frameshift${stopLost?'；注意删除了终止密码子，可能导致读穿':''}`
        };
      }
      return {featureName:fname,featureType:f.type||'CDS',kind:'in-frame deletion',severity:'medium',text:`${fname}: 删除 ${len} bp（${v.ref}），长度为 3 的倍数，不造成 frameshift；但不在完整 codon 边界上，可能改变连接处两侧氨基酸`};
    }
    const anchorIdx=positions.indexOf(v.pos);
    if(anchorIdx<0) return null;
    const insertAfterIdx=anchorIdx+1;
    const atCodonBoundary=insertAfterIdx%3===0;
    const insertedCoding=strand==='-'?rcSeq(v.read):dna(v.read);
    if(!inFrame){
      return {featureName:fname,featureType:f.type||'CDS',kind:'移码风险',severity:'high',text:`${fname}: 插入 ${len} bp（${v.read}），会造成 frameshift 风险`};
    }
    const codons=(insertedCoding.match(/.{1,3}/g)||[]).filter(x=>x.length===3);
    const aas=codons.map(translateCodon).join('');
    return {featureName:fname,featureType:f.type||'CDS',kind:'in-frame insertion',severity:'medium',text:`${fname}: 插入 ${len} bp（${v.read}，${aas||'X'}），${atCodonBoundary?'位于 codon 边界，':'不在 codon 边界，'}不造成 frameshift${atCodonBoundary?'':'，但可能改变连接处氨基酸'}`};
  }

  function deletedPositionsForVariant(v,plasmid){
    const n=plasmid.seq.length;
    const len=dna(v.ref).length||v.length||1;
    const out=[];
    for(let i=0;i<len;i++) out.push(((v.pos-1+i)%n)+1);
    return out;
  }

  function variantContexts(v,plasmid){
    const contexts=[];
    const names=(v.features||[]).map(f=>`${f.type} ${f.name}`).join(' | ');
    if(/tag|标签|his|flag|ha|myc|linker|连接肽/i.test(names)) contexts.push('tag/linker');
    if(/homology|同源|arm/i.test(names)) contexts.push('同源臂');
    if((v.primers||[]).length) contexts.push('引物结合区');
    if((v.enzymes||[]).length) contexts.push('酶切位点');
    boundaryHits(plasmid,v.pos,8).forEach(x=>contexts.push(`${x.name} ${x.side}连接处±${x.distance} bp`));
    return [...new Set(contexts)];
  }

  function boundaryHits(plasmid,pos,windowSize){
    if(!plasmid||!pos) return [];
    const n=plasmid.seq.length;
    const out=[];
    (plasmid.features||[]).forEach(f=>{
      const s=parseInt(f.start), e=parseInt(f.end);
      if(!s||!e) return;
      const ds=circularDistance(pos,s,n), de=circularDistance(pos,e,n);
      if(ds<=windowSize) out.push({name:f.name||f.type||'Feature',side:'起点',distance:ds,feature:f});
      if(de<=windowSize) out.push({name:f.name||f.type||'Feature',side:'终点',distance:de,feature:f});
    });
    return out.sort((a,b)=>a.distance-b.distance).slice(0,6);
  }
  function circularDistance(a,b,n){ const d=Math.abs(a-b); return Math.min(d,n-d); }

  function orientedQuality(result){
    return result.orientation==='-'?(result.trimmed.trimmedQuality||[]).slice().reverse():(result.trimmed.trimmedQuality||[]);
  }

  function buildColumns(result,plasmid){
    const a=result.alignment, q=orientedQuality(result);
    const varByAln=new Map();
    result.variants.forEach((v,i)=>{
      const start=v.alnIndex, end=v.alnEndIndex==null?v.alnIndex:v.alnEndIndex;
      for(let k=start;k<=end;k++) varByAln.set(k,i);
    });
    const sampleByRef={};
    for(let k=0;k<a.refAln.length;k++){
      const refRaw=a.refIdx[k];
      const refPos=refRaw==null?null:((refRaw-1)%plasmid.seq.length)+1;
      const qb=a.readAln[k];
      if(refPos!=null){
        sampleByRef[refPos]=qb==='-'?'-':qb;
      }
    }
    return a.refAln.split('').map((rb,k)=>{
      const qb=a.readAln[k];
      const refRaw=a.refIdx[k];
      const refPos=refRaw==null?null:((refRaw-1)%plasmid.seq.length)+1;
      const readPos=a.readIdx[k];
      const vi=varByAln.has(k)?varByAln.get(k):null;
      const qual=readPos?q[readPos-1]:null;
      return {i:k,ref:rb,read:qb,refPos,readPos,variantIndex:vi,quality:qual,sampleByRef};
    });
  }

  async function runSelectedAlignmentFiles(){
    const input=$('alignFileInput');
    if(!input||!input.files||!input.files.length){ setAlignStatus('请先选择 .ab1 / .abi 测序文件。','warn'); return; }
    const plasmid=currentPlasmid();
    if(!plasmid){ setAlignStatus('请先打开或导入一个参考质粒，再进行测序比对。','warn'); return; }
    const options={cutoff:$('alignQCut')?.value||20,windowSize:$('alignWindow')?.value||20,minLen:$('alignMinLen')?.value||40};
    setAlignStatus('正在解析 AB1 并比对到当前质粒…');
    const notes=[];
    for(const file of [...input.files]){
      try{
        const read=parseAbiRead(await file.arrayBuffer(),safeName(file));
        const result=alignOneRead(read,plasmid,options);
        ALIGN_STATE.reads.push(read);
        ALIGN_STATE.results.push(result);
        ALIGN_STATE.selected=ALIGN_STATE.results.length-1;
        ALIGN_STATE.selectedVariant=result.variants.length?0:-1;
        const verdict=result.summary||recommendClone(result,result.reference);
        notes.push(`${file.name}: ${read.seq.length} bp，${result.orientation==='-'?'反向互补':'正向'}，identity ${(result.alignment.identity*100).toFixed(1)}%，差异 ${result.variants.length} 个；${verdict.title}`);
      }catch(e){
        notes.push(`${file.name}: 解析或比对失败：${e&&e.message?e.message:e}`);
      }
    }
    renderAlignmentResults();
    setAlignStatus(notes.join('\n')||'没有读取到文件。');
    input.value='';
  }

  function renderAlignmentResults(){
    const list=$('alignReadList'), summary=$('alignSummary'), out=$('alignOutput');
    if(!list||!summary||!out) return;
    if(!ALIGN_STATE.results.length){
      list.innerHTML='';
      summary.innerHTML='<div class="status">请选择 .ab1 文件；程序会比对到当前打开的质粒，并在这里生成多视图联动验证界面。</div>';
      out.innerHTML='';
      return;
    }
    if(!ALIGN_STATE.results[ALIGN_STATE.selected]) ALIGN_STATE.selected=0;
    const r=ALIGN_STATE.results[ALIGN_STATE.selected];
    const plasmid=r.reference||currentPlasmid();
    if(!plasmid){ out.innerHTML='<div class="status warn">没有可用的参考质粒。</div>'; return; }
    if(ALIGN_STATE.selectedVariant>=r.variants.length) ALIGN_STATE.selectedVariant=r.variants.length?0:-1;

    list.innerHTML=ALIGN_STATE.results.map((x,i)=>`<button type="button" class="alignReadChip ${i===ALIGN_STATE.selected?'active':''}" data-align-read="${i}">${esc(x.read.name)} · ${x.orientation==='-'?'RC':'+'} · ${x.variants.length}差异</button>`).join('');
    list.querySelectorAll('[data-align-read]').forEach(btn=>btn.onclick=()=>{ALIGN_STATE.selected=parseInt(btn.dataset.alignRead);ALIGN_STATE.selectedVariant=ALIGN_STATE.results[ALIGN_STATE.selected].variants.length?0:-1;renderAlignmentResults();setTimeout(scrollToSelectedVariant,0);});

    const verdict=recommendClone(r,plasmid);
    r.summary=verdict;
    const aln=r.alignment;
    const strong=r.variants.filter(isEvidenceVariant).length;
    const weak=r.variants.length-strong;
    summary.innerHTML=`
      <div class="alignStats">
        <div class="alignStat"><b>${esc(r.read.name)}</b><br><span class="small">read：${r.read.rawLength||r.read.seq.length} bp；${esc(r.trimmed.trimNote)}</span></div>
        <div class="alignStat"><b>${r.orientation==='-'?'反向互补':'正向'}</b><br><span class="small">自动选择得分更高方向</span></div>
        <div class="alignStat"><b>${(aln.identity*100).toFixed(1)}%</b><br><span class="small">identity；score ${aln.score}</span></div>
        <div class="alignStat"><b>${aln.refStart}..${aln.refEnd}</b><br><span class="small">参考覆盖范围 / ${plasmid.seq.length} bp</span></div>
        <div class="alignStat"><b>${strong}</b><br><span class="small">中/高质量差异；低质量 ${weak}</span></div>
        <div class="alignStat"><b>${verdict.action}</b><br><span class="small">${esc(verdict.title)}</span></div>
      </div>`;

    out.innerHTML=`
      ${overviewHtml(r,plasmid)}
      <div class="alignWorkspace">
        <div class="alignBox alignCanvasShell">
          <h3>主比对视图</h3>
          <div class="alignToolbar">
            <span class="small">Reference 在上，Sample/Read 在下；红=错配，蓝=插入，橙=缺失，虚线=低质量 base。</span>
            <button type="button" id="alignJumpSelectedBtn">跳到当前差异</button>
          </div>
          ${alignmentCanvasHtml(r,plasmid)}
        </div>
        <div class="alignBox alignSide">
          <h3>差异列表</h3>
          <div class="alignVariantTable">${variantTableHtml(r,plasmid)}</div>
        </div>
      </div>
      ${detailHtml(r,plasmid)}
    `;
    bindAlignmentEvents();
  }

  function overviewHtml(r,plasmid){
    const n=plasmid.seq.length;
    const coverage=rangeBlocks(r.alignment.refStart,r.alignment.refEnd,n).map(b=>`<div class="ovCoverage" style="left:${b.left}%;width:${b.width}%"></div>`).join('');
    const features=(plasmid.features||[]).slice(0,80).flatMap(f=>rangeBlocks(f.start,f.end,n).map(b=>({f,b}))).map(({f,b})=>`<div class="ovFeature" style="left:${b.left}%;width:${Math.max(b.width,.35)}%;background:${safeColor(f.color)}" title="${esc(f.name||f.type)}"><span>${esc(shortText(f.name||f.type,24))}</span></div>`).join('');
    const markers=r.variants.map((v,i)=>{
      const left=(((v.pos||1)-1)/Math.max(1,n))*100;
      const active=i===ALIGN_STATE.selectedVariant?' active':'';
      return `<button type="button" class="ovMarker ${v.type}${active}" style="left:${left}%;" data-align-var="${i}" title="${esc(variantOneLine(v))}"></button>`;
    }).join('');
    return `
      <div class="alignOverviewBox mt">
        <h3>全局差异概览</h3>
        <div class="alignOverviewInner">
          <div class="alignOverviewTrack">
            ${coverage}${features}${markers}
          </div>
          <div class="alignLegend">
            <span><i class="legendDot mis"></i>mismatch</span>
            <span><i class="legendDot ins"></i>insertion</span>
            <span><i class="legendDot del"></i>deletion</span>
            <span><i class="legendDot feat"></i>feature 区域</span>
            <span>淡蓝背景=本条 read 覆盖范围。点击任意差异点可跳转。</span>
          </div>
        </div>
      </div>`;
  }

  function rangeBlocks(start,end,n){
    start=parseInt(start); end=parseInt(end);
    if(!start||!end||!n) return [];
    if(start<=end) return [block(start,end,n)];
    return [block(start,n,n),block(1,end,n)];
  }
  function block(start,end,n){
    return {left:((start-1)/n)*100,width:Math.max(.2,((end-start+1)/n)*100)};
  }

  function alignmentCanvasHtml(r,plasmid){
    const cols=buildColumns(r,plasmid);
    const prefs={
      aa:$('alignShowAa')?.checked!==false,
      features:$('alignShowFeatures')?.checked!==false,
      primers:$('alignShowPrimers')?.checked!==false,
      enzymes:$('alignShowEnzymes')?.checked!==false
    };
    const rows=[];
    rows.push(rowHtml('Pos',rulerCells(cols),'alnRuler'));
    if(prefs.features) rows.push(rowHtml('Feature',featureCells(cols,plasmid),'alnFeature'));
    if(prefs.primers) rows.push(rowHtml('Primer/HR',primerCells(cols,plasmid),'alnPrimer'));
    if(prefs.enzymes) rows.push(rowHtml('Enzyme',enzymeCells(cols,plasmid),'alnEnzyme'));
    if(prefs.aa){
      rows.push(rowHtml('AA Ref',aaCells(cols,plasmid,false),'alnAa'));
      rows.push(rowHtml('AA Sample',aaCells(cols,plasmid,true),'alnAa'));
    }
    rows.push(rowHtml('Reference',baseCells(cols,'ref'),''));
    rows.push(rowHtml('',midCells(cols),''));
    rows.push(rowHtml('Sample',baseCells(cols,'read'),''));
    return `<div class="alignScroll" id="alignScroll"><div class="alignCanvas">${rows.join('')}</div></div>`;
  }

  function rowHtml(label,cells,cls){ return `<div class="alnRow ${cls||''}"><span class="alnLabel">${esc(label)}</span><span class="alnCells">${cells}</span></div>`; }

  function cellAttrs(col,extraTitle){
    const vi=col.variantIndex;
    const title=[col.refPos?`Ref ${col.refPos}`:'插入列', col.readPos?`Read ${col.readPos}`:'', extraTitle||'', vi!=null?variantOneLine(currentResult().variants[vi]):''].filter(Boolean).join('；');
    return `data-align-col="${col.i}" ${vi!=null?`data-align-var="${vi}"`:''} title="${esc(title)}"`;
  }
  function currentResult(){ return ALIGN_STATE.results[ALIGN_STATE.selected]||{variants:[]}; }

  function rulerCells(cols){
    return cols.map((c,idx)=>{
      const show=c.refPos && (idx===0 || c.refPos%10===0 || idx===cols.length-1);
      return `<span class="alnCell ${show?'tick':''}" ${cellAttrs(c)}>${show?esc(c.refPos):''}</span>`;
    }).join('');
  }

  function featureCells(cols,plasmid){
    let last='';
    return cols.map(c=>{
      const feats=c.refPos?featuresAtPosition(plasmid,c.refPos):[];
      const f=feats[0];
      const name=f?(f.name||f.type||'Feature'):'';
      const label=f&&name!==last?shortText(name,22):'';
      last=name;
      const bg=f?`style="background:${safeColor(f.color)};opacity:.78"`:'';
      return `<span class="alnCell alnFeatureCell ${f?'hasFeature':''}" ${cellAttrs(c,feats.map(x=>x.name||x.type).join(', '))} ${bg} data-label="${esc(label)}"></span>`;
    }).join('');
  }

  function primerCells(cols,plasmid){
    let last='';
    return cols.map(c=>{
      const prs=c.refPos?primersAtPosition(plasmid,c.refPos):[];
      const hom=c.refPos?featuresAtPosition(plasmid,c.refPos).filter(f=>/homology|同源|arm|junction|连接处/i.test(`${f.type||''} ${f.name||''}`)):[];
      const obj=prs[0]||hom[0];
      const name=obj?(obj.name||obj.type||'Primer/HR'):'';
      const label=obj&&name!==last?shortText(name,22):'';
      last=name;
      const color=prs[0]?((prs[0].strand||'+')==='-'?'#eadcff':'#fff2cc'):(hom[0]?safeColor(hom[0].color):'');
      return `<span class="alnCell alnPrimerCell ${obj?'hasPrimer':''}" ${cellAttrs(c,[...prs.map(x=>x.name),...hom.map(x=>x.name)].join(', '))} ${obj?`style="background:${color}"`:''} data-label="${esc(label)}"></span>`;
    }).join('');
  }

  function enzymeCells(cols,plasmid){
    let last='';
    return cols.map(c=>{
      const enzymes=c.refPos?enzymesAtPosition(plasmid,c.refPos):[];
      const e=enzymes[0];
      const name=e?e.name:'';
      const label=e&&name!==last?shortText(name,18):'';
      last=name;
      return `<span class="alnCell alnEnzymeCell ${e?'hasEnzyme':''}" ${cellAttrs(c,enzymes.map(x=>x.name).join(', '))} ${e?'style="background:#fee2e2;color:#991b1b"':''} data-label="${esc(label)}"></span>`;
    }).join('');
  }

  function aaCells(cols,plasmid,sample){
    return cols.map(c=>{
      const info=aaInfoForColumn(c,plasmid,sample);
      if(!info) return `<span class="alnCell alnAaCell" ${cellAttrs(c)}></span>`;
      const changed=sample&&info.changed?' aaChanged':'';
      const label=info.show?`${info.aa}${info.index}`:'';
      return `<span class="alnCell alnAaCell coding${changed}" ${cellAttrs(c,info.title)}>${esc(label)}</span>`;
    }).join('');
  }

  function aaInfoForColumn(col,plasmid,sample){
    if(!col.refPos) return null;
    const cds=featuresAtPosition(plasmid,col.refPos).find(f=>/CDS|coding/i.test(String(f.type||'')) || f.translate);
    if(!cds) return null;
    const positions=featurePositions(plasmid,cds);
    const idx=positions.indexOf(col.refPos);
    if(idx<0) return null;
    const codonIndex=Math.floor(idx/3);
    const codonPos=positions.slice(codonIndex*3,codonIndex*3+3);
    if(codonPos.length<3) return null;
    const strand=cds.strand||'+';
    const refCodon=codonForPositions(plasmid,codonPos,strand,null);
    const refAa=translateCodon(refCodon);
    const sampleMap={};
    if(sample){
      Object.keys(col.sampleByRef||{}).forEach(k=>{sampleMap[k]=col.sampleByRef[k];});
    }
    if(sample){
      const sampleBases=codonPos.map(pos=>Object.prototype.hasOwnProperty.call(sampleMap,pos)?sampleMap[pos]:baseAt(plasmid.seq,pos));
      const deletedCount=sampleBases.filter(b=>b==='-').length;
      if(deletedCount===3){
        return {aa:'Δ'+refAa,index:codonIndex+1,show:idx%3===0,changed:true,title:`${cds.name||'CDS'} aa${codonIndex+1}: 删除 ${refCodon}(${refAa})，in-frame codon deletion`};
      }
      if(deletedCount>0){
        return {aa:'fs',index:codonIndex+1,show:idx%3===0,changed:true,title:`${cds.name||'CDS'} aa${codonIndex+1}: codon 部分缺失，frameshift/边界风险`};
      }
      const sampleCodon=codonForPositions(plasmid,codonPos,strand,sampleMap);
      const aa=translateCodon(sampleCodon);
      return {aa,index:codonIndex+1,show:idx%3===0,changed:aa!==refAa,title:`${cds.name||'CDS'} aa${codonIndex+1}: ${sampleCodon}(${aa})`};
    }
    return {aa:refAa,index:codonIndex+1,show:idx%3===0,changed:false,title:`${cds.name||'CDS'} aa${codonIndex+1}: ${refCodon}(${refAa})`};
  }

  function baseCells(cols,which){
    return cols.map(c=>{
      const b=which==='ref'?c.ref:c.read;
      const cls=baseClass(c,which);
      return `<span class="alnCell ${which==='ref'?'alnRefBase':'alnReadBase'} ${cls}" ${cellAttrs(c)}>${esc(b)}</span>`;
    }).join('');
  }

  function baseClass(c,which){
    const classes=[];
    const selected=c.variantIndex!=null&&c.variantIndex===ALIGN_STATE.selectedVariant;
    if(c.ref==='-'||c.read==='-') classes.push('alnGap');
    if(c.variantIndex!=null){
      const v=currentResult().variants[c.variantIndex];
      if(v.type==='mismatch') classes.push('alnMismatch');
      else if(v.type==='ins') classes.push(which==='read'?'alnIns':'alnGap');
      else if(v.type==='del') classes.push(which==='ref'?'alnDel':'alnGap');
      else classes.push('alnAmbiguous');
    }else if(c.ref===c.read&&exactBase(c.ref)) classes.push('alnMatch');
    if(which==='read'&&c.quality!=null&&c.quality<20) classes.push('alnLow');
    if(selected) classes.push('alnSelected');
    return classes.join(' ');
  }

  function midCells(cols){
    return cols.map(c=>{
      let mark=' ';
      if(c.ref==='-') mark='+';
      else if(c.read==='-') mark='-';
      else if(c.ref===c.read&&exactBase(c.ref)) mark='|';
      else mark='*';
      const cls=c.variantIndex!=null&&c.variantIndex===ALIGN_STATE.selectedVariant?'alnSelected':'';
      return `<span class="alnCell alnMid ${cls}" ${cellAttrs(c)}>${esc(mark)}</span>`;
    }).join('');
  }

  function variantTableHtml(r,plasmid){
    if(!r.variants.length) return '<div class="status ok">覆盖区未发现 mismatch、insertion 或 deletion。</div>';
    const rows=r.variants.map((v,i)=>{
      const active=i===ALIGN_STATE.selectedVariant?'active':'';
      const q=v.quality==null?'':v.quality;
      const conf=v.confidence==='weak'?'低质量疑点':(v.confidence==='strong'?'高质量':'中等质量');
      const cls=v.confidence==='weak'?'weakVar':'strongVar';
      const impact=(v.impacts||[]).join('<br>')||'非 CDS / 未注释';
      const features=(v.features||[]).map(f=>f.name).join(', ')||'';
      return `<tr class="${active}" data-align-var="${i}"><td>${i+1}</td><td class="${typeClass(v.type)}">${typeLabel(v.type)}</td><td>${v.pos||''}</td><td>${esc(v.ref)}</td><td>${esc(v.read)}</td><td>${q}</td><td class="${cls}">${conf}</td><td>${esc(impact)}</td><td>${esc(features)}</td></tr>`;
    }).join('');
    return `<table><thead><tr><th>#</th><th>类型</th><th>位置</th><th>Ref</th><th>Sample</th><th>Q</th><th>证据</th><th>氨基酸影响</th><th>所在 feature</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function typeClass(t){ return t==='mismatch'?'typeMismatch':t==='ins'?'typeIns':t==='del'?'typeDel':''; }
  function typeLabel(t){ return t==='mismatch'?'错配':t==='ins'?'插入':t==='del'?'缺失':'N/不确定'; }
  function variantOneLine(v){ return `${typeLabel(v.type)} ${v.pos||''}: ${v.ref}→${v.read}${v.quality!=null?' Q'+v.quality:''}`; }

  function detailHtml(r,plasmid){
    const summary=recommendClone(r,plasmid);
    const v=r.variants[ALIGN_STATE.selectedVariant];
    const variantPart=v?selectedVariantDetail(r,plasmid,v,ALIGN_STATE.selectedVariant):noVariantDetail(r,plasmid);
    return `
      <div class="alignDetail">
        <h3>当前差异 / 连接处解释与克隆建议</h3>
        <div class="alignDetailBody">
          <div class="verdictCard ${summary.level}">
            <b>${esc(summary.title)}</b>
            <div class="mt">${esc(summary.action)}</div>
            <div class="small mt">${esc(summary.note)}</div>
          </div>
          <div>${variantPart}</div>
        </div>
      </div>`;
  }

  function noVariantDetail(r,plasmid){
    const coverage=`${r.alignment.refStart}..${r.alignment.refEnd}`;
    const uncovered=plasmid.seq.length-r.alignment.alignedBases;
    return `<ul class="detailList">
      <li>本条 read 覆盖参考区域 ${esc(coverage)}，覆盖区内未检出碱基差异。</li>
      <li>CDS、tag/linker、引物、同源臂和酶切位点在覆盖区内未出现高质量异常。</li>
      <li>注意：Sanger read 不能证明未覆盖区域正确；若构建跨越多个 junction，建议用两端或内部引物分别验证。</li>
      ${uncovered>0?`<li>当前 read 只评价覆盖区，不代表整条 ${plasmid.seq.length} bp 质粒全部无误。</li>`:''}
    </ul>`;
  }

  function selectedVariantDetail(r,plasmid,v,index){
    const run=variantRun(r,index);
    const featureText=(v.features||[]).map(f=>`${f.name}${f.type?`(${f.type})`:''}`).join(', ')||'未落在已注释 feature 内';
    const primerText=(v.primers||[]).map(p=>p.name).join(', ')||'无';
    const enzymeText=(v.enzymes||[]).join(', ')||'无';
    const impacts=(v.impacts||[]).length?v.impacts:['非 CDS 或当前质粒没有对应 CDS 注释，无法判断氨基酸改变。'];
    const ctx=(v.contexts||[]).length?v.contexts:[];
    const interpretation=interpretVariant(r,plasmid,v,index);
    return `
      <ul class="detailList">
        <li><b>${esc(typeLabel(v.type))}</b>：参考位置 ${esc(v.pos||'插入列')}，Ref=${esc(v.ref)}，Sample=${esc(v.read)}，${v.quality!=null?`Q=${v.quality}`:'无直接 Q 值'}；连续同类差异长度约 ${run.length} bp。</li>
        <li>所在 feature：${esc(featureText)}；引物/同源臂：${esc(primerText)}；酶切位点：${esc(enzymeText)}。</li>
        <li>氨基酸/reading frame：${impacts.map(esc).join('；')}</li>
        <li>解释：${esc(interpretation)}</li>
      </ul>
      <div class="contextPills">
        ${ctx.map(x=>`<span class="contextPill">${esc(x)}</span>`).join('')||'<span class="contextPill">普通序列区域</span>'}
      </div>`;
  }

  function variantRun(r,index){
    const vars=r.variants||[];
    const v=vars[index];
    if(!v) return {start:index,end:index,length:0,seq:''};
    if((v.type==='ins'||v.type==='del') && v.length){
      return {start:index,end:index,length:v.length,seq:v.type==='del'?v.ref:v.read};
    }
    let s=index,e=index;
    while(s>0 && sameRun(vars[s-1],vars[s])) s--;
    while(e+1<vars.length && sameRun(vars[e],vars[e+1])) e++;
    const part=vars.slice(s,e+1);
    return {start:s,end:e,length:part.length,seq:part.map(x=>x.type==='del'?x.ref:x.read).join('')};
  }
  function sameRun(a,b){
    if(!a||!b||a.type!==b.type) return false;
    if(Math.abs((a.alnIndex||0)-(b.alnIndex||0))>1) return false;
    if(a.type==='ins') return a.pos===b.pos;
    if(a.type==='del') return Math.abs((a.pos||0)-(b.pos||0))<=1;
    return false;
  }

  function interpretVariant(r,plasmid,v,index){
    if(v.confidence==='weak') return '这是低质量疑点，暂不建议直接判为真实突变；优先查看峰图或换引物复测。';
    const run=variantRun(r,index);
    const inCds=(v.impactDetails||[]).length>0;
    const hasStop=(v.impactDetails||[]).some(x=>x.kind==='终止');
    const hasMissense=(v.impactDetails||[]).some(x=>x.kind==='错义');
    const silent=(v.impactDetails||[]).some(x=>x.kind==='沉默');
    const inTagOrLinker=(v.contexts||[]).some(x=>/tag|linker/i.test(x));
    const nearJunction=(v.contexts||[]).some(x=>/连接处/.test(x));
    const inHomology=(v.contexts||[]).includes('同源臂');
    if(v.type==='ins'||v.type==='del'){
      const frame=run.length%3===0?'reading frame 可能保持，但仍需确认插入/缺失是否为设计内容':'会改变 reading frame，若发生在 CDS/tag/linker 内通常不建议保留';
      if(inTagOrLinker) return `该 indel 位于 tag/linker 相关区域，${frame}。如果它不是设计连接序列的一部分，建议淘汰该克隆。`;
      if(inCds) return `该 indel 位于 CDS，${frame}。`;
      if(nearJunction||inHomology) return '该 indel 靠近连接处/同源臂，可能提示同源重组 junction 不干净；建议用跨 junction 引物复核。';
      return '该 indel 不在已注释 CDS 内；若它不是设计变化，仍建议复核原始峰图。';
    }
    if(hasStop) return '该点突变在 CDS 中引入终止密码子；除非这是设计目的，否则不推荐保留该克隆。';
    if(hasMissense) return '该点突变造成错义氨基酸变化；如果不是目标突变，通常不推荐保留该克隆。';
    if(silent) return '该点突变为沉默突变，蛋白序列不变；若不影响调控元件/酶切位点/引物结合，通常可以保留，但仍需确认是否符合构建目的。';
    if(nearJunction) return '该差异靠近 feature 边界/连接处；即使不是 CDS 改变，也建议重点确认 junction 是否与设计一致。';
    if(inHomology) return '该差异位于同源臂区域，可能影响后续重组或说明连接模板不一致；建议复核。';
    return '这是普通点突变；当前注释不足以判断蛋白影响，建议结合设计目标和峰图确认。';
  }

  function isEvidenceVariant(v){ return v && v.confidence!=='weak' && v.type!=='ambiguous'; }
  function recommendClone(r,plasmid){
    const evidence=(r.variants||[]).filter(isEvidenceVariant);
    if(!evidence.length){
      return {level:'pass',title:'覆盖区构建验证通过',action:'推荐保留',note:'在本条 read 覆盖范围内未发现中/高质量差异；未覆盖区域仍需其他测序读段确认。'};
    }
    const severe=evidence.some(v=>{
      const run=variantRun(r,(r.variants||[]).indexOf(v));
      const impacts=v.impactDetails||[];
      const frameshift=(v.type==='ins'||v.type==='del')&&run.length%3!==0&&impacts.length;
      return frameshift || impacts.some(x=>x.severity==='high'||x.kind==='终止'||x.kind==='移码风险') || (v.contexts||[]).some(x=>/tag\/linker|连接处/.test(x));
    });
    if(severe){
      return {level:'fail',title:'发现高风险构建差异',action:'不推荐直接保留',note:'存在 frameshift/终止突变/tag-linker 或 junction 风险；除非这些变化正是设计目的，否则建议换克隆。'};
    }
    const missense=evidence.some(v=>(v.impactDetails||[]).some(x=>x.kind==='错义'));
    if(missense){
      return {level:'warn',title:'发现 CDS 错义差异',action:'谨慎保留',note:'如果该错义不是目标突变，建议淘汰；若是设计突变，请确认其他区域无额外差异。'};
    }
    const onlySilent=evidence.every(v=>(v.impactDetails||[]).some(x=>x.kind==='沉默') || !(v.impactDetails||[]).length);
    if(onlySilent){
      return {level:'warn',title:'发现非高危差异',action:'可复核后保留',note:'主要为沉默或非 CDS 差异；请确认没有影响调控元件、引物结合或酶切位点。'};
    }
    return {level:'warn',title:'发现需要人工确认的差异',action:'复核后决定',note:'当前差异不一定破坏构建，但需要结合设计目标、峰图质量和其他 reads 判断。'};
  }

  function bindAlignmentEvents(){
    const root=$('alignOutput');
    if(!root) return;
    root.querySelectorAll('[data-align-var]').forEach(el=>{
      el.addEventListener('click',ev=>{
        const i=parseInt(el.dataset.alignVar);
        if(Number.isNaN(i)) return;
        ev.preventDefault();
        selectVariant(i,true);
      });
    });
    const jump=$('alignJumpSelectedBtn');
    if(jump) jump.onclick=()=>scrollToSelectedVariant();
  }

  function selectVariant(i,scroll){
    ALIGN_STATE.selectedVariant=i;
    renderAlignmentResults();
    if(scroll) setTimeout(scrollToSelectedVariant,0);
  }

  function scrollToSelectedVariant(){
    const r=currentResult();
    const v=r.variants&&r.variants[ALIGN_STATE.selectedVariant];
    if(!v) return;
    const el=document.querySelector(`#alignOutput [data-align-col="${v.alnIndex}"]`);
    if(el&&el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  }

  function exportAlignmentReport(){
    if(!ALIGN_STATE.results.length){ setAlignStatus('没有可导出的比对结果。','warn'); return; }
    const lines=['read\torientation\tidentity\tref_start\tref_end\trecommendation\ttype\tposition\tref\tsample\tquality\tconfidence\timpact\tfeature\tcontext'];
    ALIGN_STATE.results.forEach(r=>{
      const plasmid=r.reference||currentPlasmid();
      const rec=recommendClone(r,plasmid);
      if(!r.variants.length){
        lines.push([r.read.name,r.orientation,(r.alignment.identity*100).toFixed(2),r.alignment.refStart,r.alignment.refEnd,rec.action,'OK','','','','','','','',''].join('\t'));
      }else{
        r.variants.forEach(v=>lines.push([
          r.read.name,r.orientation,(r.alignment.identity*100).toFixed(2),r.alignment.refStart,r.alignment.refEnd,rec.action,
          typeLabel(v.type),v.pos||'',v.ref,v.read,v.quality??'',v.confidence,
          (v.impacts||[]).join('; '),(v.features||[]).map(f=>f.name).join('; '),(v.contexts||[]).join('; ')
        ].join('\t')));
      }
    });
    const name=(currentPlasmid()?.name||'PlasmidLab')+'_Sanger_alignment.tsv';
    downloadFile(name,lines.join('\n'),'text/tab-separated-values;charset=utf-8');
  }

  window.plabParseAb1Buffer=parseAbiRead;
  window.plabAlignSangerRead=alignOneRead;
  window.plabAlignmentState=ALIGN_STATE;
  window.plabRenderAlignmentResults=renderAlignmentResults;
  window.plabShowAlignmentView=showAlignmentView;

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installUi);
  else installUi();
})();
