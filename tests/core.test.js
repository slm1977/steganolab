const assert=require('node:assert/strict'),C=require('../core.js');const w=8,h=8,d=new Uint8ClampedArray(w*h*4).fill(100);for(let i=3;i<d.length;i+=4)d[i]=255;for(const order of ['RGB','G','BGR'])for(const scan of ['row','col'])for(const bit of [0,7]){const s=C.encode(d,w,h,order,scan,bit,'È!');assert.equal(C.decode(C.extract(s,w,h,order,scan,bit,24)),'È!');for(let i=0;i<d.length;i++)assert.equal((d[i]^s[i])&~(1<<bit),0);for(let i=3;i<d.length;i+=4)assert.equal(s[i],255);}assert.throws(()=>C.decode('1'));assert.throws(()=>C.encode(d,w,h,'R','row',0,'x'.repeat(9)));assert.deepEqual(C.diff(d,d),{pixels:0,values:0,max:0});assert.deepEqual([...C.positions(2,2,'R','col')],[0,8,4,12]);console.log('Core tests passed');
const cover=Uint8ClampedArray.from([100,101,102,255,101,102,103,255]),mask=Uint8ClampedArray.from([255,255,255,255,0,0,0,255]);const hidden=C.hideMask(cover,mask,'G',1);assert.deepEqual([...C.plane(hidden,'G',1)],[255,255,255,255,0,0,0,255]);assert.deepEqual([...C.plane(hidden,'G',1,cover)],[255,255,255,255,255,255,255,255]);assert.deepEqual(C.move(0,0,-1,0,2,2),[0,0]);assert.deepEqual(C.move(0,0,1,1,2,2),[1,1]);assert.throws(()=>C.hideMask(cover,new Uint8ClampedArray(4),'R',0));console.log('Image and navigation tests passed');

// Vettori indipendenti: coordinate esplicite e bit UTF-8 MSB-first senza header.
assert.deepEqual([...C.positions(2,3,'AR','row',true)],
	[3,0,7,4,11,8,15,12,19,16,23,20]);
assert.deepEqual([...C.positions(2,3,['A','R'],'col',true)],
	[3,0,11,8,19,16,7,4,15,12,23,20]);
assert.deepEqual([...C.positions(2,2,'R','row')],[0,4,8,12]);
assert.deepEqual([...C.positions(2,2,'R','col')],[0,8,4,12]);
const sample=Uint8ClampedArray.from(Array.from({length:128*4},(_,i)=>
	i%4===3?[0,1,128,255][Math.floor(i/4)%4]:(i*37+19)%256));
const sampleBefore=sample.slice();
for(const [order,hasAlpha] of [['RGB',false],['A',true],['RGBA',true],['AGR',true]]){
	for(const scan of ['row','col'])for(const bit of [0,1,4,7])for(const message of ['CIAO','È già 😀']){
		const bytes=Buffer.from(message,'utf8'),n=bytes.length*8;
		const result=C.encode(sample,8,16,order,scan,bit,message,hasAlpha);
		assert.notEqual(result,sample);
		assert.deepEqual(sample,sampleBefore);
		const expectedBits=[...bytes].map(b=>b.toString(2).padStart(8,'0')).join('');
		assert.equal(C.extract(result,8,16,order,scan,bit,n,hasAlpha),expectedBits);
		assert.equal(C.decode(expectedBits),message);
		const allowed=new Set([...C.positions(8,16,order,scan,hasAlpha)].slice(0,n));
		for(let i=0;i<sample.length;i++){
			assert.equal((sample[i]^result[i])&~(1<<bit),0);
			if(!allowed.has(i))assert.equal(result[i],sample[i]);
		}
	}
}
// Bit già uguali e pixel trasparenti sono comunque letti e occupano capacità.
const transparent=Uint8ClampedArray.from([173,135,185,0,173,135,185,1,173,135,185,0,173,135,185,1,
	173,135,185,0,173,135,185,1,173,135,185,0,173,135,185,1]);
assert.equal(C.extract(transparent,8,1,'A','row',0,8,true),'01010101');
const alphaEncoded=C.encode(transparent,8,1,'A','row',0,'U',true);
assert.deepEqual(alphaEncoded,transparent); // Anche nessun bit cambiato è un messaggio valido.
const rgbEncoded=C.encode(transparent,8,1,'R','row',0,'U',true);
assert.equal(C.decode(C.extract(rgbEncoded,8,1,'R','row',0,8,true)),'U');
for(let i=0;i<transparent.length;i++)if(i%4!==0)assert.equal(rgbEncoded[i],transparent[i]);

// Capacità esatta in bit, incluse stringhe UTF-8 multibyte e dimensioni non multiple di 8.
const exact=new Uint8ClampedArray(8*4);
assert.equal(C.decode(C.extract(C.encode(exact,8,1,'A','row',2,'x',true),8,1,'A','row',2,8,true)),'x');
assert.throws(()=>C.encode(exact,8,1,'A','row',2,'é',true),/troppo lungo/);
assert.throws(()=>C.encode(new Uint8ClampedArray(7*4),7,1,'R','row',0,'x'),/troppo lungo/);
assert.equal(C.extract(exact,8,1,'R','row',0,0),'');
assert.throws(()=>C.extract(exact,8,1,'R','row',0,9),/capacità/);
assert.throws(()=>C.extract(exact,8,1,'R','row',0,-1),/capacità/);
assert.throws(()=>C.extract(exact,8,1,'R','row',0,1.5),/capacità/);
assert.equal(C.decode(''),'');
assert.throws(()=>C.decode('101x0000'));
assert.throws(()=>C.decode('11111111')); // UTF-8 non valido.

// Validazione immediata anche per un messaggio vuoto o un'estrazione di zero bit.
for(const order of ['', 'RR', 'RAA', 'X', 'toString', ['RG'], null]){
	assert.throws(()=>C.positions(2,2,order,'row',true));
	assert.throws(()=>C.encode(new Uint8ClampedArray(16),2,2,order,'row',0,'',true));
	assert.throws(()=>C.extract(new Uint8ClampedArray(16),2,2,order,'row',0,0,true));
}
assert.throws(()=>C.positions(2,2,'A','row'),/RGBA/);
assert.throws(()=>C.encode(new Uint8ClampedArray(16),2,2,'RA','row',0,''),/RGBA/);
assert.throws(()=>C.extract(new Uint8ClampedArray(16),2,2,'A','row',0,0),/RGBA/);
assert.throws(()=>C.plane(cover,'A',0),/RGBA/);
assert.throws(()=>C.hideMask(cover,mask,'A',0),/RGBA/);
assert.throws(()=>C.positions(0,2,'R','row'));
assert.throws(()=>C.positions(2,1.5,'R','row'));
assert.throws(()=>C.positions(Number.MAX_SAFE_INTEGER,2,'R','row'));
assert.throws(()=>C.positions(2,2,'R','diagonal'));
assert.throws(()=>C.positions(2,2,'A','row',1));
assert.throws(()=>C.encode(exact,8,1,'R','row',8,''));
assert.throws(()=>C.extract(exact,8,1,'R','row',-1,0));
assert.throws(()=>C.encode(exact,2,1,'R','row',0,''));
assert.throws(()=>C.extract(exact,2,1,'R','row',0,0));
assert.throws(()=>C.plane(new Uint8Array(3),'R',0));
assert.throws(()=>C.diff(cover,new Uint8Array(4)));

// Differenze RGB, RGBA e miste: il padding non è alfa nativo.
const a=Uint8ClampedArray.from([10,20,30,0,40,50,60,1,70,80,90,255]);
const b=Uint8ClampedArray.from([11,20,30,1,40,48,60,0,70,80,90,127]);
assert.deepEqual(C.diff(a,b),{pixels:2,values:2,max:2});
assert.deepEqual(C.diff(a,b,false,false),{pixels:2,values:2,max:2,channels:{R:1,G:1,B:0},formatsDiffer:false});
assert.deepEqual(C.diff(a,b,true,true),{pixels:3,values:5,max:128,channels:{R:1,G:1,B:0,A:3},formatsDiffer:false});
for(const formats of [[true,false],[false,true]])
	assert.deepEqual(C.diff(a,b,...formats),{pixels:2,values:2,max:2,channels:{R:1,G:1,B:0},formatsDiffer:true});
assert.throws(()=>C.diff(a,b,true,'true'));

// Piani e XOR sono opachi anche per RGB invisibili e alfa nullo.
const gray=bits=>Uint8ClampedArray.from(bits.flatMap(v=>[v*255,v*255,v*255,255]));
assert.deepEqual(C.plane(a,'A',0,null,true),gray([0,1,1]));
assert.deepEqual(C.plane(a,'A',7,null,true),gray([0,0,1]));
assert.deepEqual(C.plane(a,'A',0,b,true,true),gray([1,1,0]));
assert.deepEqual(C.plane(a,'R',0,b,true,false),gray([1,0,0]));
assert.deepEqual(C.plane(a,'R',0,b,false,true),gray([1,0,0]));
for(const [order,hasAlpha] of [['RGB',false],['RGBA',true]])for(const channel of order)for(let bit=0;bit<8;bit++){
	const c='RGBA'.indexOf(channel);
	const values=Array.from({length:a.length/4},(_,i)=>(a[i*4+c]>>bit)&1);
	const changes=Array.from({length:a.length/4},(_,i)=>((a[i*4+c]^b[i*4+c])>>bit)&1);
	assert.deepEqual(C.plane(a,channel,bit,null,hasAlpha),gray(values));
	assert.deepEqual(C.plane(a,channel,bit,b,hasAlpha,hasAlpha),gray(changes));
}
assert.throws(()=>C.plane(a,'A',0,b,true,false),/RGBA/);
assert.throws(()=>C.plane(a,'A',0,b,false,true),/RGBA/);
assert.throws(()=>C.plane(a,'R',0,new Uint8Array(4)));

// Maschera: soglia 383/384 sui byte RGB grezzi, alfa della maschera ignorato.
const maskRGBA=Uint8ClampedArray.from([127,128,128,255,128,128,128,0,255,255,255,0]);
const aBefore=a.slice(),maskBefore=maskRGBA.slice();
for(const [channel,hasAlpha,index] of [['R',false,0],['G',false,1],['A',true,3]])for(const bit of [0,7]){
	const out=C.hideMask(a,maskRGBA,channel,bit,hasAlpha);
	assert.deepEqual(C.plane(out,channel,bit,null,hasAlpha),gray([0,1,1]));
	for(let i=0;i<a.length;i++){
		assert.equal((a[i]^out[i])&~(1<<bit),0);
		if(i%4!==index)assert.equal(out[i],a[i]);
	}
}
assert.deepEqual(a,aBefore);assert.deepEqual(maskRGBA,maskBefore);

// Regressione del protocollo delle sei missioni: riferimento separato dal core.
function missionCover(w,h){
	const data=new Uint8ClampedArray(w*h*4);
	for(let y=0;y<h;y++)for(let x=0;x<w;x++){
		const rock=y>8+Math.sin(x/5)*4&&x>10;
		data.set(rock?[174+x%9,155+y%11,119+x%7,255]:[60+x%15,135+y*3,185+x%17,255],(y*w+x)*4);
	}
	return data;
}
function legacyText(data,w,h,order,scan,bit,text){
	const out=data.slice(),bits=[...Buffer.from(text,'utf8')].map(b=>b.toString(2).padStart(8,'0')).join('');
	let k=0;
	for(let outer=0;outer<(scan==='row'?h:w);outer++)for(let inner=0;inner<(scan==='row'?w:h);inner++){
		const x=scan==='row'?inner:outer,y=scan==='row'?outer:inner;
		for(const c of order){if(k>=bits.length)return out;const p=(y*w+x)*4+'RGB'.indexOf(c);out[p]=(out[p]&~(1<<bit))|(Number(bits[k++])<<bit);}
	}
	return out;
}
for(const [msg,order,scan,bit] of [['CIAO','RGB','row',0],['FARO','G','row',0],['NORD','B','col',0],['TRAC','RG','row',2]]){
	const data=missionCover(32,20),encoded=C.encode(data,32,20,order,scan,bit,msg);
	assert.deepEqual(encoded,legacyText(data,32,20,order,scan,bit,msg));
	assert.equal(C.decode(C.extract(encoded,32,20,order,scan,bit,32)),msg);
}
for(const mission of [3,4]){
	const w=64,h=48,data=missionCover(w,h),secret=new Uint8ClampedArray(data.length),expected=data.slice();
	const channel=mission===3?'G':'B',bit=mission===3?0:1,c='RGB'.indexOf(channel),expectedPlane=[];
	for(let y=0;y<h;y++)for(let x=0;x<w;x++){
		const on=mission===3?((x-23)**2+(y-17)**2<100||(x-41)**2+(y-17)**2<100||(y>=17&&y<42&&Math.abs(x-32)<(42-y)*0.85)):
			(x>=5&&x<=53&&Math.abs(y-(39-x*0.55+4*Math.sin(x/5)))<1.5&&x%8<5)||(x>=49&&x<=61&&y>=4&&y<=16&&(Math.abs(x-55-(y-10))<1.5||Math.abs(x-55+(y-10))<1.5));
		const i=(y*w+x)*4,v=on?255:0;secret.set([v,v,v,255],i);
		expected[i+c]=(expected[i+c]&~(1<<bit))|(Number(on)<<bit);expectedPlane.push(Number(on));
	}
	const result=C.hideMask(data,secret,channel,bit);
	assert.deepEqual(result,expected);
	assert.deepEqual(C.plane(result,channel,bit),gray(expectedPlane));
}
console.log('RGBA, validation, protocol and six mission regression tests passed');
{const assert=require('node:assert/strict'),C=require('../core.js');const d=new Uint8ClampedArray(6*5*4).fill(100);for(const scan of ['row','col']){const a=C.encode(d,6,5,'RGB',scan,0,'OK',false,2,1);assert.equal(C.decode(C.extract(a,6,5,'RGB',scan,0,16,false,2,1)),'OK');const before=[...C.positions(6,5,'RGB',scan)].slice(0,C.startIndex(6,5,scan,2,1)*3);for(const i of before)assert.equal(a[i],d[i]);}assert.throws(()=>C.encode(d,6,5,'RGB','row',0,'OK',false,5,4));assert.throws(()=>C.extract(d,6,5,'RGB','row',0,1,false,-1,0));}
