const DEFAULT_TYPE={식사:"🍴",관광:"🪂",쇼핑:"🛍️",예약:"🎫",숙소:"🏨",이동:"🚶",주요이동:"✈️"};

function readJSON(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    return raw===null||raw===""?fallback:JSON.parse(raw);
  }catch(error){
    console.warn(`저장 데이터 읽기 실패: ${key}`,error);
    return fallback;
  }
}

let TYPE={...DEFAULT_TYPE,...readJSON("travelTypeEmoji",{})};

const SAMPLE=[
{날짜:"2026-10-08",시간:"01:00",일정:"인천공항 → 샘플 공항",유형:"주요이동",세부사항:"주요이동은 단독된 박스로 표시됩니다"},
{날짜:"2026-10-08",시간:"12:45",일정:"샘플 공항 → 관광 명소",유형:"이동",세부사항:"지하철 00분 / 000역 → 000역(000 환승)"},
{날짜:"2026-10-08",시간:"16:20",일정:"관광 명소",유형:"관광",세부사항:"관광지에 대한 정보를 입력해주세요"},
{날짜:"2026-10-08",시간:"17:00",일정:"쇼핑 명소",유형:"쇼핑",세부사항:"쇼핑에 대한 정보를 입력해주세요"},
{날짜:"2026-10-08",시간:"19:25",일정:"식당",유형:"식사",세부사항:"식사에 대한 정보를 입력해주세요"}
];



let data=readJSON("travelData",null)||SAMPLE;
let selectedDate=null;
let trip=readJSON("travelTrip",null)||{start:"2026-10-08",end:"2026-10-18",region:"SAMPLE"};
let reservations=readJSON("travelReservations",[]);
let infoItems=readJSON("travelInfoItems",null);

if(!infoItems){
  const old=JSON.parse(localStorage.getItem("travelInfo")||"null")||{};
  infoItems=Object.entries(old).map(([key,details],i)=>({
    id:"migrated-"+key,
    emoji:["✈️","🚇","💳","📱"][i]||"ℹ️",
    title:{flight:"항공",transport:"교통",payment:"결제 · 통화",useful:"유용한 정보"}[key]||key,
    description:"",
    details
  }));
  saveInfoItems();
}

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#39;"
}[c]));

function normalizeDate(v){
  if(v instanceof Date&&!isNaN(v))
    return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;

  const s=String(v??"").trim();

  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){
    const[y,m,d]=s.split("-");
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }

  if(/^\d{5}$/.test(s)){
    const dt=new Date(1899,11,30);
    dt.setDate(dt.getDate()+Number(s));
    return normalizeDate(dt);
  }

  return s;
}

function normalizeTime(v){
  if(v instanceof Date&&!isNaN(v))
    return `${String(v.getHours()).padStart(2,"0")}:${String(v.getMinutes()).padStart(2,"0")}`;

  const s=String(v??"").trim();

  if(/^\d+(\.\d+)?$/.test(s)){
    const n=Number(s);

    if(n>=0&&n<1){
      const mins=Math.round(n*1440);
      return `${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`;
    }
  }

  return s;
}

function parseLocalDate(s){
  const m=String(s||"").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return m?new Date(+m[1],+m[2]-1,+m[3]):new Date(s);
}

function fmtLong(d){
  const x=parseLocalDate(d),
  w=["일","월","화","수","목","금","토"][x.getDay()];
  return `${x.getMonth()+1}월 ${x.getDate()}일 · ${w}요일`;
}

function fmtTab(d){
  const x=parseLocalDate(d),
  w=["일","월","화","수","목","금","토"][x.getDay()];
  return `<span class="num">${String(x.getDate()).padStart(2,"0")}</span><span class="dow">${w}</span>`;
}

function dayNo(d){
  return Math.floor((parseLocalDate(d)-parseLocalDate(trip.start))/86400000)+1;
}

function rowId(r){
  return [r.날짜,r.시간,r.일정].join("||");
}

function allDates(){
  if(trip.start&&trip.end){
    const out=[];
    let d=parseLocalDate(trip.start),
    end=parseLocalDate(trip.end);

    while(d<=end){
      out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
      d.setDate(d.getDate()+1);
    }

    return out;
  }

  return [...new Set(data.map(x=>normalizeDate(x.날짜)).filter(Boolean))].sort();
}

function saveData(){
  localStorage.setItem("travelData",JSON.stringify(data));
}

function renderTabs(){
  const dates=allDates();

  if(!selectedDate||!dates.includes(selectedDate)){
    selectedDate=dates[0]||trip.start;
  }

  const start=parseLocalDate(trip.start);
  const end=parseLocalDate(trip.end);

  if(!start||!end||isNaN(start)||isNaN(end)){
    document.querySelector("#dateTabs").innerHTML="";
    return;
  }

  const startDay=start.getDay();
  const totalDays=Math.floor((end-start)/86400000)+1;
  const cells=[];

  // 여행 시작 전 빈 칸
  for(let i=0;i<startDay;i++){
    cells.push(`<div class="date-tab-spacer"></div>`);
  }

  // 실제 여행 날짜
  for(let i=0;i<totalDays;i++){
    const d=new Date(start);
    d.setDate(start.getDate()+i);

    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    cells.push(
      `<button class="date-tab ${key===selectedDate?"active":""}" data-d="${esc(key)}">${fmtTab(key)}</button>`
    );
  }

  // 마지막 주 남은 칸
  const remainder=cells.length%7;

  if(remainder!==0){
    for(let i=remainder;i<7;i++){
      cells.push(`<div class="date-tab-spacer"></div>`);
    }
  }

  document.querySelector("#dateTabs").innerHTML=cells.join("");

  document.querySelectorAll(".date-tab").forEach(b=>{
    b.onclick=()=>{
      selectedDate=b.dataset.d;
      render();
    };
  });
}

function render(){
  renderTabs();

  document.querySelector("#tripMeta").textContent=
    `${trip.start?trip.start.replaceAll("-","."):""} — ${trip.end?trip.end.replaceAll("-","."):""}`;

  document.querySelector("#pageTitle").textContent=trip.region||"여행 일정";

  document.querySelector("#tripDaySummary").textContent=
    `DAY ${dayNo(selectedDate)} / ${allDates().length} · 오늘의 일정`;

  document.querySelector("#sideRegion").textContent=trip.region||"여행 계획";

  document.querySelector("#selectedDateTitle").textContent=fmtLong(selectedDate);

  const rows=data
    .filter(x=>normalizeDate(x.날짜)===selectedDate)
    .map((x,index)=>({...x,__order:index}))
    .sort((a,b)=>{
      const toMinutes=value=>{
        const m=String(value||"").trim().match(/^(\d{1,2}):(\d{2})/);
        return m ? Number(m[1])*60+Number(m[2]) : Number.POSITIVE_INFINITY;
      };
      const at=toMinutes(a.시간);
      const bt=toMinutes(b.시간);
      return at-bt || a.__order-b.__order;
    });

  let html="";
  let pendingMoves=[];

  const renderTravelInfo=move=>`
    <div class="travel-info">
      <div class="travel-label">${esc(TYPE["이동"]||"🚶")} 이동 정보</div>
      <b>${esc(String(move.일정||"").trim())}</b><br>${esc(String(move.세부사항||"").replace(/^○\s*/,"").trim())}
    </div>`;

  rows.forEach((r,index)=>{
    const type=String(r.유형||"").trim();

    // 날짜의 마지막 이동은 독립적인 주요이동으로 표시한다.
    if(type==="이동" && index===rows.length-1){
      const mainMove={...r,유형:"주요이동"};
      html+=`
        <article class="event main-travel" data-id="${esc(rowId(r))}">
          <div class="time">${esc(r.시간)}</div>
          <div class="dot"></div>
          <div class="card">
            <div class="card-head">
              <span class="icon">${esc(TYPE["주요이동"]||"✈️")}</span>
              <span class="title">${esc(mainMove.일정)}</span>
              <span class="chevron">⌄</span>
            </div>
            <div class="type-pill">주요이동</div>
            <div class="card-extra">
              ${mainMove.세부사항?`<div class="details">${esc(mainMove.세부사항)}</div>`:""}
            </div>
          </div>
        </article>`;
      return;
    }

    if(type==="이동"){
      pendingMoves.push(r);
      return;
    }

    const travelHtml=pendingMoves.map(renderTravelInfo).join("");
    pendingMoves=[];

    html+=`
      <article class="event" data-id="${esc(rowId(r))}">
        <div class="time">${esc(r.시간)}</div>
        <div class="dot"></div>
        <div class="card">
          <div class="card-head">
            <span class="icon">${esc(TYPE[type]||"📌")}</span>
            <span class="title">${esc(r.일정)}</span>
            <span class="chevron">⌄</span>
          </div>
          <div class="type-pill">${esc(type)}</div>
          <div class="card-extra">
            ${travelHtml}
            ${r.세부사항?`<div class="details">${esc(r.세부사항)}</div>`:""}
          </div>
        </div>
      </article>`;
  });

  // 마지막 이동이 이미 주요이동으로 처리되었으므로 여기에는 남은 이동이 없다.

  document.querySelector("#timeline").innerHTML=
    html||'<div class="empty">이 날짜에 등록된 일정이 없습니다.</div>';

  document.querySelectorAll("#timeline .event").forEach(e=>{
    e.querySelector(".card").onclick=()=>{
      e.classList.toggle("expanded");
    };
  });
}

const pageInfo={
  itinerary:["","여행 일정"],
  reservations:["BOOKINGS","예약"],
  travelinfo:["TRAVEL INFO","여행정보"],
  settings:["SETTINGS","설정"]
};

function page(p){
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  document.querySelector(`#${p}Page`).classList.remove("hidden");

  document.querySelectorAll(".nav").forEach(x=>
    x.classList.toggle("active",x.dataset.page===p)
  );

  document.querySelector("#pageEyebrow").textContent=pageInfo[p][0];

  document.querySelector("#pageTitle").textContent=
    p==="itinerary"?(trip.region||"여행 일정"):pageInfo[p][1];

  document.querySelector("#tripMeta").textContent=
    p==="itinerary"
      ?`${trip.start?trip.start.replaceAll("-","."):""} — ${trip.end?trip.end.replaceAll("-","."):""}`
      :"";

  document.querySelector("#tripDaySummary").textContent=
    p==="itinerary"
      ?`DAY ${dayNo(selectedDate)} / ${allDates().length} · 오늘의 일정`
      :"";

  if(p==="reservations")renderReservations();

  if(p==="settings"){
    renderEmojiSettings();
    loadTripForm();
    colors();
  }

  if(p==="travelinfo")renderInfo();
}

document.querySelectorAll(".nav").forEach(b=>
  b.onclick=()=>page(b.dataset.page)
);

const sidebarToggle=document.querySelector("#sidebarToggle");

if(localStorage.getItem("sidebarCollapsed")==="1")
  document.body.classList.add("sidebar-collapsed");

function updateSidebarToggle(){
  const c=document.body.classList.contains("sidebar-collapsed");

  sidebarToggle.textContent=c?"›":"‹";

  sidebarToggle.setAttribute(
    "aria-label",
    c?"메뉴 펼치기":"메뉴 접기"
  );
}

updateSidebarToggle();

sidebarToggle.onclick=()=>{
  document.body.classList.toggle("sidebar-collapsed");

  localStorage.setItem(
    "sidebarCollapsed",
    document.body.classList.contains("sidebar-collapsed")?"1":"0"
  );

  updateSidebarToggle();
};

document.querySelector("#excelInput").onchange=e=>{
  const f=e.target.files[0];
  if(!f)return;

  const reader=new FileReader();

  reader.onload=ev=>{
    try{
      const wb=XLSX.read(ev.target.result,{
        type:"array",
        cellDates:true
      });

      const sh=wb.Sheets[wb.SheetNames[0]];

      const rows=XLSX.utils.sheet_to_json(sh,{
        defval:"",
        raw:false,
        dateNF:"yyyy-mm-dd"
      });

      const imp=rows
        .map(x=>({
          날짜:normalizeDate(x.날짜),
          시간:normalizeTime(x.시간),
          일정:String(x.일정).trim(),
          유형:String(x.유형).trim(),
          세부사항:String(x.세부사항).trim()
        }))
        .filter(x=>x.날짜&&x.일정);

      if(!imp.length)
        throw Error("유효한 일정이 없습니다.");

      data=imp;

      /* 엑셀에 새로 들어온 유형 자동 추가 */
      imp.forEach(r=>{
        if(r.유형&&!TYPE[r.유형]){
          TYPE[r.유형]="📌";
        }
      });

      /* 새 유형까지 이모지 설정에 저장 */
      localStorage.setItem(
        "travelTypeEmoji",
        JSON.stringify(TYPE)
      );

      saveData();

      selectedDate=datesForImport()[0];

      page("itinerary");
      render();

      alert(`${imp.length}개의 일정을 가져왔습니다.`);
    }
    catch(err){
      alert(
        "Excel 가져오기에 실패했습니다.\n"+
        err.message
      );
    }

    e.target.value="";
  };

  reader.readAsArrayBuffer(f);
};

function datesForImport(){
  return [
    ...new Set(
      data
        .map(x=>normalizeDate(x.날짜))
        .filter(Boolean)
    )
  ].sort();
}

function loadTripForm(){
  document.querySelector("#tripStart").value=trip.start||"";
  document.querySelector("#tripEnd").value=trip.end||"";
  document.querySelector("#tripRegion").value=trip.region||"";
}

document.querySelector("#saveTrip").onclick=()=>{
  const start=document.querySelector("#tripStart").value;
  const end=document.querySelector("#tripEnd").value;

  if(start&&end&&start>end){
    alert("여행 종료일은 시작일 이후로 입력해주세요.");
    return;
  }

  trip={
    start,
    end,
    region:document.querySelector("#tripRegion").value.trim()
  };

  localStorage.setItem(
    "travelTrip",
    JSON.stringify(trip)
  );

  selectedDate=start||datesForImport()[0]||null;

  render();

  alert("여행 기본정보를 저장했습니다.");
};

async function getFiles(){
  return new Promise((resolve,reject)=>{
    const q=indexedDB.open("travelPlannerFiles",1);

    q.onupgradeneeded=()=>
      q.result.createObjectStore("files");

    q.onsuccess=()=>resolve(q.result);
    q.onerror=()=>reject(q.error);
  });
}

async function saveAttachment(id,file){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");

    tx.objectStore("files").put({
      name:file.name,
      type:file.type,
      blob:file
    },id);

    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}

async function getAttachment(id){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readonly"),
    q=tx.objectStore("files").get(id);

    q.onsuccess=()=>resolve(q.result||null);
    q.onerror=()=>reject(q.error);
  });
}

function reservationRows(){
  return reservations;
}

function saveReservations(){
  localStorage.setItem(
    "travelReservations",
    JSON.stringify(reservations)
  );
}

function renderReservations(){
  const rows=reservationRows()
    .slice()
    .sort((a,b)=>
      (a.date+a.time).localeCompare(b.date+b.time)
    );

  document.querySelector("#reservationList").innerHTML=
    rows.map(r=>{
      const id=esc(r.id);

      const meta=
        esc(r.date)+
        (r.time?" · "+esc(r.time):"")+
        (r.type?" · "+esc(r.type):"");

      return `
        <article class="reservation-card">
          <div class="reservation-main">
            <div class="res-icon">${esc(TYPE[r.type]||"🎫")}</div>

            <div>
              <h3>${esc(r.title)}</h3>
              <p>${meta}</p>
            </div>
          </div>

          <div class="reservation-actions">
            <button class="ghost res-view" data-id="${id}">
              예약 보기
            </button>

            <label class="ghost file-label">
              🎟️ 티켓 가져오기
              <input
                class="ticket-input"
                data-id="${id}"
                type="file"
                accept="image/*,.pdf,application/pdf"
                hidden
              >
            </label>
          </div>
        </article>
      `;
    }).join("")
    ||'<div class="empty">등록한 예약이 없습니다.</div>';

  document.querySelectorAll(".ticket-input").forEach(x=>
    x.onchange=async e=>{
      const f=e.target.files[0];
      if(!f)return;

      try{
        await saveAttachment(e.target.dataset.id,f);

        alert(
          "티켓/예약 파일을 저장했습니다. ‘예약 보기’에서 확인할 수 있습니다."
        );
      }
      catch(err){
        alert(
          "파일 저장에 실패했습니다.\n"+
          err.message
        );
      }

      e.target.value="";
    }
  );

  document.querySelectorAll(".res-view").forEach(b=>
    b.onclick=()=>showReservation(b.dataset.id)
  );
}

function reservationForm(){
  const types=
    Object.keys(DEFAULT_TYPE)
      .filter(t=>t!=="이동"&&t!=="주요이동");

  document.querySelector("#reservationForm").innerHTML=`
    <div class="add-form-grid">

      <label>
        예약명
        <input
          id="resTitle"
          placeholder="예: 런던 → 파로 항공권"
        >
      </label>

      <label>
        날짜
        <input id="resDate" type="date">
      </label>

      <label>
        시간
        <input id="resTime" type="time">
      </label>

      <label>
        유형
        <select id="resType">
          ${types.map(t=>
            `<option value="${esc(t)}">${esc(t)}</option>`
          ).join("")}
        </select>
      </label>

      <label class="full">
        상세내용
        <textarea
          id="resDetails"
          placeholder="예약번호, 주소, 체크인 정보 등"
        ></textarea>
      </label>

    </div>

    <div class="form-actions">
      <button id="cancelRes" class="ghost">취소</button>
      <button id="saveRes" class="primary">예약 저장</button>
    </div>
  `;

  document.querySelector("#resDate").value=
    selectedDate||trip.start;

  document.querySelector("#cancelRes").onclick=()=>{
    document.querySelector("#reservationForm")
      .classList.add("hidden");
  };

  document.querySelector("#saveRes").onclick=()=>{
    const title=
      document.querySelector("#resTitle").value.trim();

    const date=
      document.querySelector("#resDate").value;

    if(!title||!date){
      alert("예약명과 날짜를 입력해주세요.");
      return;
    }

    const id=
      (crypto.randomUUID
        ?crypto.randomUUID()
        :Date.now().toString()+Math.random().toString(16).slice(2)
      );

    reservations.push({
      id,
      title,
      date,
      time:document.querySelector("#resTime").value,
      type:document.querySelector("#resType").value,
      details:document.querySelector("#resDetails").value.trim()
    });

    saveReservations();

    document.querySelector("#reservationForm")
      .classList.add("hidden");

    renderReservations();
  };
}

document.querySelector("#addReservationBtn").onclick=()=>{
  reservationForm();
  document.querySelector("#reservationForm")
    .classList.remove("hidden");
};

async function deleteAttachment(id){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");

    tx.objectStore("files").delete(id);

    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}


function editReservation(id){
  const r=reservations.find(x=>x.id===id);
  if(!r)return;

  reservationForm();
  document.querySelector("#reservationForm").classList.remove("hidden");
  document.querySelector("#resTitle").value=r.title||"";
  document.querySelector("#resDate").value=r.date||"";
  document.querySelector("#resTime").value=r.time||"";
  document.querySelector("#resType").value=r.type||"";
  document.querySelector("#resDetails").value=r.details||"";

  const saveBtn=document.querySelector("#saveRes");
  saveBtn.textContent="예약 수정";
  saveBtn.onclick=()=>{
    const title=document.querySelector("#resTitle").value.trim();
    const date=document.querySelector("#resDate").value;
    if(!title||!date){alert("예약명과 날짜를 입력해주세요.");return;}
    r.title=title;
    r.date=date;
    r.time=document.querySelector("#resTime").value;
    r.type=document.querySelector("#resType").value;
    r.details=document.querySelector("#resDetails").value.trim();
    saveReservations();
    document.querySelector("#reservationForm").classList.add("hidden");
    renderReservations();
  };

  document.querySelector("#reservationModal").classList.add("hidden");
}

async function showReservation(id){
  const r=reservationRows().find(x=>x.id===id);
  if(!r)return;

  const att=await getAttachment(id);

  const modal=document.querySelector("#reservationModal");
  const modalTitle=document.querySelector("#modalTitle");
  const modalMeta=document.querySelector("#modalMeta");
  const modalDetails=document.querySelector("#modalDetails");
  const preview=document.querySelector("#ticketPreview");
  const ticketName=document.querySelector("#ticketName");

  modalTitle.textContent=r.title;

  modalMeta.textContent=
    [r.date,r.time,r.type]
      .filter(Boolean)
      .join(" · ");

  modalDetails.textContent=
    r.details||"";

  preview.innerHTML="";

  if(att){
    const url=URL.createObjectURL(att.blob);

    if(
      att.type==="application/pdf"||
      /\.pdf$/i.test(att.name)
    ){
      preview.innerHTML=
        `<iframe src="${url}" title="${esc(att.name)}"></iframe>`;
    }
    else{
      preview.innerHTML=
        `<img src="${url}" alt="${esc(att.name)}">`;
    }

    ticketName.textContent=att.name;
  }
  else{
    ticketName.textContent=
      "첨부된 티켓/예약 파일이 없습니다.";
  }


  // 예약 수정 / 삭제 버튼
  const modalBox=document.querySelector("#reservationModal .modal-box");
  let actionBox=document.querySelector("#reservationModal .reservation-modal-actions");
  if(!actionBox){
    actionBox=document.createElement("div");
    actionBox.className="reservation-modal-actions";
    modalBox.appendChild(actionBox);
  }
  actionBox.innerHTML=`
    <button id="editReservation" class="ghost">예약 수정</button>
    <button id="deleteReservation" class="ghost">예약 삭제</button>`;

  document.querySelector("#editReservation").onclick=()=>editReservation(id);
  const deleteBtn=document.querySelector("#deleteReservation");

  deleteBtn.onclick=async()=>{
    if(!confirm("이 예약을 삭제할까요?"))return;

    reservations=
      reservations.filter(x=>x.id!==id);

    saveReservations();

    try{
      await deleteAttachment(id);
    }
    catch(err){
      console.error(
        "첨부파일 삭제 실패:",
        err
      );
    }

    modal.classList.add("hidden");

    renderReservations();
  };


  // 모달 열기
  modal.classList.remove("hidden");
}

document.querySelector("#closeModal").onclick=()=>{
  const modal=document.querySelector("#reservationModal");
  modal.classList.add("hidden");

  const preview=document.querySelector("#ticketPreview");
  const iframe=preview.querySelector("iframe");
  const img=preview.querySelector("img");

  if(iframe?.src?.startsWith("blob:")) URL.revokeObjectURL(iframe.src);
  if(img?.src?.startsWith("blob:")) URL.revokeObjectURL(img.src);
};

document.querySelector("#reservationModal").onclick=e=>{
  if(e.target.id==="reservationModal"){
    const modal=e.currentTarget;
    const preview=document.querySelector("#ticketPreview");
    const iframe=preview.querySelector("iframe");
    const img=preview.querySelector("img");

    if(iframe?.src?.startsWith("blob:")) URL.revokeObjectURL(iframe.src);
    if(img?.src?.startsWith("blob:")) URL.revokeObjectURL(img.src);

    modal.classList.add("hidden");
  }
};

/* 유형별 이모지 설정 */
function renderEmojiSettings(){
  const box=document.querySelector("#emojiSettings");

  box.innerHTML=
    Object.keys(TYPE)
      .map(t=>`
        <label class="emoji-row">
          <span>
            <b class="emoji-preview">${esc(TYPE[t])}</b>
            ${esc(t)}
          </span>

          <input
            type="text"
            maxlength="4"
            value="${esc(TYPE[t])}"
            data-type="${esc(t)}"
          >
        </label>
      `)
      .join("");

  box.querySelectorAll("input").forEach(x=>{
    x.oninput=e=>{
      const type=e.target.dataset.type;

      TYPE[type]=e.target.value||"📌";

      localStorage.setItem(
        "travelTypeEmoji",
        JSON.stringify(TYPE)
      );

      render();
    };
  });
}

function saveInfoItems(){
  localStorage.setItem(
    "travelInfoItems",
    JSON.stringify(infoItems)
  );
}

function renderInfo(){
  const box=document.querySelector("#infoGrid");

  box.innerHTML=
    infoItems.map(item=>`
      <article
        class="info-card"
        data-id="${esc(item.id)}"
      >
        <div class="info-head">
          <span class="info-emoji">
            ${esc(item.emoji)}
          </span>

          <div>
            <h2>${esc(item.title)}</h2>
            <p class="info-description">
              ${esc(item.description||"")}
            </p>
          </div>
        </div>

        <div class="info-details">
          ${esc(item.details||"")}
        </div>

        <div class="info-actions">
          <button class="ghost info-edit">수정</button>
          <button class="ghost info-delete">삭제</button>
        </div>
      </article>
    `).join("")
    ||'<div class="empty">등록한 여행정보가 없습니다.</div>';

  document.querySelectorAll(".info-card").forEach(card=>{
    card.onclick=e=>{
      if(e.target.closest("button"))return;
      card.classList.toggle("expanded");
    };

    card.querySelector(".info-edit").onclick=e=>{
      e.stopPropagation();
      showInfoForm(card.dataset.id);
    };

    card.querySelector(".info-delete").onclick=e=>{
      e.stopPropagation();

      if(confirm("이 여행정보를 삭제할까요?")){
        infoItems=
          infoItems.filter(x=>x.id!==card.dataset.id);

        saveInfoItems();
        renderInfo();
      }
    };
  });
}

function showInfoForm(id=null){
  const item=id
    ?infoItems.find(x=>x.id===id)
    :null;

  document.querySelector("#infoForm").innerHTML=`
    <div class="add-form-grid">

      <label>
        이모지
        <input
          id="infoEmoji"
          maxlength="4"
          value="${esc(item?.emoji||"ℹ️")}"
        >
      </label>

      <label>
        제목
        <input
          id="infoTitle"
          value="${esc(item?.title||"")}"
          placeholder="예: 항공"
        >
      </label>

      <label class="full">
        설명
        <input
          id="infoDescription"
          value="${esc(item?.description||"")}"
          placeholder="예: 항공편, 좌석, 수하물 정보"
        >
      </label>

      <label class="full">
        상세내용
        <textarea
          id="infoDetails"
          placeholder="여행 중 참고할 상세 정보를 입력하세요."
        >${esc(item?.details||"")}</textarea>
      </label>

    </div>

    <div class="form-actions">
      <button id="cancelInfo" class="ghost">취소</button>
      <button id="saveInfo" class="primary">
        ${id?"수정 저장":"여행정보 저장"}
      </button>
    </div>
  `;

  document.querySelector("#infoForm")
    .classList.remove("hidden");

  document.querySelector("#cancelInfo").onclick=()=>{
    document.querySelector("#infoForm")
      .classList.add("hidden");
  };

  document.querySelector("#saveInfo").onclick=()=>{
    const title=
      document.querySelector("#infoTitle").value.trim();

    if(!title){
      alert("제목을 입력해주세요.");
      return;
    }

    const obj={
      id:
        id||
        ((crypto.randomUUID&&crypto.randomUUID())||
        Date.now().toString()),

      emoji:
        document.querySelector("#infoEmoji").value.trim()||
        "ℹ️",

      title,

      description:
        document.querySelector("#infoDescription").value.trim(),

      details:
        document.querySelector("#infoDetails").value.trim()
    };

    if(id){
      const i=infoItems.findIndex(x=>x.id===id);
      infoItems[i]=obj;
    }
    else{
      infoItems.push(obj);
    }

    saveInfoItems();

    document.querySelector("#infoForm")
      .classList.add("hidden");

    renderInfo();
  };
}

document.querySelector("#addInfoBtn").onclick=()=>
  showInfoForm();

function colors(){
  const b=
    localStorage.getItem("travelBg")||"#f6f5f1";

  const a=
    localStorage.getItem("travelAccent")||"#6d63c7";

  document.documentElement.style.setProperty(
    "--bg",
    b
  );

  document.documentElement.style.setProperty(
    "--accent",
    a
  );

  document.querySelector("#bgColor").value=b;
  document.querySelector("#accentColor").value=a;
}

document.querySelector("#bgColor").oninput=e=>{
  localStorage.setItem("travelBg",e.target.value);
  colors();
};

document.querySelector("#accentColor").oninput=e=>{
  localStorage.setItem("travelAccent",e.target.value);
  colors();
};

document.querySelector("#resetColors").onclick=()=>{
  localStorage.removeItem("travelBg");
  localStorage.removeItem("travelAccent");
  colors();
};

document.querySelector("#downloadSample").onclick=()=>{
  const rows=[
    ["날짜","시간","일정","유형","세부사항"],
    ["2026-10-08","01:00","인천공항 → 샘플 공항","주요이동","주요이동은 단독된 박스로 표시됩니다"],
    ["2026-10-08","12:45","샘플 공항 → 관광 명소","이동","이동 정보는 다음 일정 카드에 함께 표시됩니다"],
    ["2026-10-08","16:20","관광 명소","관광","관광지에 대한 정보를 입력해주세요"],
    ["2026-10-08","17:00","쇼핑 명소","쇼핑","쇼핑에 대한 정보를 입력해주세요"],
    ["2026-10-08","19:25","식당","식사","식사에 대한 정보를 입력해주세요"]
  ];

  const ws=XLSX.utils.aoa_to_sheet(rows);
  const wb=XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    "여행일정"
  );

  XLSX.writeFile(
    wb,
    "여행일정_엑셀양식.xlsx"
  );
};

colors();
render();


/* =========================================================
   전체 데이터 백업 / 복원
   ========================================================= */

async function getAllStoredFiles(){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readonly");
    const store=tx.objectStore("files");
    const request=store.openCursor();
    const files=[];

    request.onsuccess=()=>{
      const cursor=request.result;

      if(cursor){
        files.push({
          id:cursor.key,
          name:cursor.value?.name||"attachment",
          type:cursor.value?.type||"application/octet-stream",
          blob:cursor.value?.blob||null
        });

        cursor.continue();
      }else{
        resolve(files);
      }
    };

    request.onerror=()=>reject(request.error);
  });
}


async function clearStoredFiles(){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");
    tx.objectStore("files").clear();

    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}


async function saveImportedFile(id,file){
  const db=await getFiles();

  return new Promise((resolve,reject)=>{
    const tx=db.transaction("files","readwrite");

    tx.objectStore("files").put({
      name:file.name,
      type:file.type,
      blob:file
    },id);

    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}


/* 전체 데이터 내보내기 */

document.querySelector("#exportAllData").onclick=async()=>{

  try{

    const wb=XLSX.utils.book_new();

    /* 일정 */
    const itineraryRows=[
      ["날짜","시간","일정","유형","세부사항"],
      ...data.map(item=>[
        item.날짜||"",
        item.시간||"",
        item.일정||"",
        item.유형||"",
        item.세부사항||""
      ])
    ];

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(itineraryRows),
      "일정"
    );


    /* 예약 */

    const reservationRows=[
      ["id","제목","날짜","시간","유형","세부사항","첨부파일"],
      ...reservations.map(item=>[
        item.id||"",
        item.title||"",
        item.date||"",
        item.time||"",
        item.type||"",
        item.details||"",
        ""
      ])
    ];

    const storedFiles=await getAllStoredFiles();

    for(const row of reservationRows.slice(1)){

      const reservation=reservations.find(
        r=>String(r.id)===String(row[0])
      );

      if(!reservation) continue;

      const file=storedFiles.find(
        f=>String(f.id)===String(reservation.id)
      );

      if(file){
        row[6]=file.name||"";
      }
    }

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(reservationRows),
      "예약"
    );


    /* 여행정보 */

    const infoRows=[
      ["id","이모지","제목","설명","상세내용"],
      ...infoItems.map(item=>[
        item.id||"",
        item.emoji||"",
        item.title||"",
        item.description||"",
        item.details||""
      ])
    ];

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(infoRows),
      "여행정보"
    );


    /* 여행 설정 */

    const tripRows=[
      ["항목","값"],
      ["start",trip.start||""],
      ["end",trip.end||""],
      ["region",trip.region||""]
    ];

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(tripRows),
      "여행설정"
    );


    /* 앱 설정 */

    const appRows=[
      ["항목","값"],
      ["travelTypeEmoji",JSON.stringify(TYPE)],
      ["travelBg",localStorage.getItem("travelBg")||"#f6f5f1"],
      ["travelAccent",localStorage.getItem("travelAccent")||"#6d63c7"],
      ["sidebarCollapsed",localStorage.getItem("sidebarCollapsed")||"0"]
    ];

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(appRows),
      "앱설정"
    );


    /* Excel 생성 */

    const excelData=XLSX.write(wb,{
      bookType:"xlsx",
      type:"array"
    });


    /* ZIP 생성 */

    const zip=new JSZip();

    zip.file(
      "TravelPlanner_데이터.xlsx",
      excelData
    );


    /* 첨부파일 */

    for(const file of storedFiles){

      if(!file.blob) continue;

      zip.file(
        `attachments/${file.id}__${file.name}`,
        file.blob
      );
    }


    const zipBlob=await zip.generateAsync({
      type:"blob"
    });


    /* 다운로드 */

    const url=URL.createObjectURL(zipBlob);
    const a=document.createElement("a");

    a.href=url;
    a.download="TravelPlanner_데이터.zip";
    a.click();

    URL.revokeObjectURL(url);

  }catch(error){

    console.error(error);

    alert(
      "데이터 내보내기 중 오류가 발생했습니다.\n\n"+
      (error.message||error)
    );
  }
};


/* 전체 데이터 가져오기 */

document.querySelector("#importAllData").onchange=async e=>{

  const file=e.target.files[0];

  if(!file) return;

  if(!/\.zip$/i.test(file.name) && file.type!=="application/zip"){
    alert("Travel Planner에서 내보낸 .zip 데이터 파일을 선택해주세요.");
    e.target.value="";
    return;
  }

  const confirmed=confirm(
    "현재 앱에 저장된 전체 데이터가 가져온 파일의 내용으로 교체됩니다.\n\n"+
    "계속하시겠습니까?"
  );

  if(!confirmed){

    e.target.value="";
    return;
  }


  try{

    const zip=await JSZip.loadAsync(file);

    const excelEntry=zip.file("TravelPlanner_데이터.xlsx");

    if(!excelEntry){
      throw new Error(
        "TravelPlanner_데이터.xlsx 파일을 찾을 수 없습니다."
      );
    }


    /* Excel 읽기 */

    const excelArray=await excelEntry.async("arraybuffer");

    const wb=XLSX.read(excelArray,{
      type:"array"
    });

    if(!wb.Sheets["일정"] && !wb.Sheets["예약"] && !wb.Sheets["여행정보"]){
      throw new Error("백업 파일의 데이터 시트를 찾을 수 없습니다.");
    }


    /* 일정 */

    if(wb.Sheets["일정"]){

      const rows=XLSX.utils.sheet_to_json(
        wb.Sheets["일정"],
        {
          defval:"",
          raw:false
        }
      );

      data=rows.map(row=>({
        날짜:String(row.날짜||""),
        시간:String(row.시간||""),
        일정:String(row.일정||""),
        유형:String(row.유형||""),
        세부사항:String(row.세부사항||"")
      }));

      saveData();
    }


    /* 예약 */

    if(wb.Sheets["예약"]){

      const rows=XLSX.utils.sheet_to_json(
        wb.Sheets["예약"],
        {
          defval:"",
          raw:false
        }
      );

      reservations=rows.map(row=>({
        id:String(row.id||""),
        title:String(row.제목||""),
        date:String(row.날짜||""),
        time:String(row.시간||""),
        type:String(row.유형||""),
        details:String(row.세부사항||"")
      }));

      saveReservations();
    }


    /* 여행정보 */

    if(wb.Sheets["여행정보"]){

      const rows=XLSX.utils.sheet_to_json(
        wb.Sheets["여행정보"],
        {
          defval:"",
          raw:false
        }
      );

      infoItems=rows.map(row=>({
        id:String(row.id||("info-"+Date.now()+"-"+Math.random())),
        emoji:String(row.이모지||"ℹ️"),
        title:String(row.제목||""),
        description:String(row.설명||""),
        details:String(row.상세내용||"")
      }));

      saveInfoItems();
    }


    /* 여행 설정 */

    if(wb.Sheets["여행설정"]){

      const rows=XLSX.utils.sheet_to_json(
        wb.Sheets["여행설정"],
        {
          header:1,
          defval:"",
          raw:false
        }
      );

      const tripValues={};

      rows.slice(1).forEach(row=>{
        if(row[0]){
          tripValues[String(row[0])]=String(row[1]||"");
        }
      });

      trip={
        start:tripValues.start||"",
        end:tripValues.end||"",
        region:tripValues.region||""
      };

      localStorage.setItem(
        "travelTrip",
        JSON.stringify(trip)
      );
    }


    /* 앱 설정 */

    if(wb.Sheets["앱설정"]){

      const rows=XLSX.utils.sheet_to_json(
        wb.Sheets["앱설정"],
        {
          header:1,
          defval:"",
          raw:false
        }
      );

      const appValues={};

      rows.slice(1).forEach(row=>{
        if(row[0]){
          appValues[String(row[0])]=String(row[1]||"");
        }
      });


      if(appValues.travelTypeEmoji){

        try{

          TYPE=JSON.parse(
            appValues.travelTypeEmoji
          );

          localStorage.setItem(
            "travelTypeEmoji",
            JSON.stringify(TYPE)
          );

        }catch(error){
          console.warn(
            "travelTypeEmoji 복원 실패",
            error
          );
        }
      }


      if(appValues.travelBg){

        localStorage.setItem(
          "travelBg",
          appValues.travelBg
        );
      }


      if(appValues.travelAccent){

        localStorage.setItem(
          "travelAccent",
          appValues.travelAccent
        );
      }


      if(appValues.sidebarCollapsed!==undefined){

        localStorage.setItem(
          "sidebarCollapsed",
          appValues.sidebarCollapsed
        );
      }
    }


    /* 첨부파일 복원 */

    await clearStoredFiles();

    const attachmentEntries=
      Object.keys(zip.files)
      .filter(name=>
        name.startsWith("attachments/") &&
        !zip.files[name].dir
      );


    for(const path of attachmentEntries){

      const entry=zip.files[path];

      const filename=
        path.substring("attachments/".length);

      const separator=filename.indexOf("__");

      if(separator===-1) continue;

      const id=filename.substring(0,separator);
      const originalName=filename.substring(separator+2);

      const blob=await entry.async("blob");

      const attachment=new File(
        [blob],
        originalName,
        {
          type:blob.type||"application/octet-stream"
        }
      );

      await saveImportedFile(
        id,
        attachment
      );
    }


    /* 화면 설정 즉시 반영 */

    const savedBg=
      localStorage.getItem("travelBg")||"#f6f5f1";

    const savedAccent=
      localStorage.getItem("travelAccent")||"#6d63c7";

    document.documentElement.style.setProperty(
      "--bg",
      savedBg
    );

    document.documentElement.style.setProperty(
      "--accent",
      savedAccent
    );


    if(localStorage.getItem("sidebarCollapsed")==="1"){
      document.body.classList.add("sidebar-collapsed");
    }else{
      document.body.classList.remove("sidebar-collapsed");
    }


    alert(
      "전체 데이터가 정상적으로 가져와졌습니다.\n\n"+
      "화면을 새로고침합니다."
    );

    location.reload();


  }catch(error){

    console.error(error);

    alert(
      "데이터 가져오기 중 오류가 발생했습니다.\n\n"+
      (error.message||error)
    );

  }finally{

    e.target.value="";
  }
};