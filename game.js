
// --- Constants & Config ---

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 40;
const FPS = 90; // Increased from 60 to 90 (1.5x Speed)

const ELEMENTS = {
    NONE: '無',
    LIGHT: '光',
    DARK: '暗',
    WATER: '水',
    FIRE: '火',
    WIND: '風',
    EARTH: '土',
    POISON: '毒'
};

const ELEMENT_COLORS = {
    '無': '#B0BEC5',
    '光': '#FFF59D',
    '暗': '#7B1FA2',
    '水': '#29B6F6',
    '火': '#EF5350',
    '風': '#26A69A',
    '土': '#8D6E63',
    '毒': '#C6FF00'
};

// Attack Multipliers: attacker -> defender
const ELEMENT_CHART = {
    // Water > Fire > Wind > Earth > Water
    // Light <> Dark
    // Poison > Earth/Water, Poison < Fire/Wind/Light
    // None is neutral
};

// Initialize Chart
for (let k in ELEMENTS) ELEMENT_CHART[ELEMENTS[k]] = {};

function setRel(atk, def, val) { 
    if (ELEMENT_CHART[atk]) {
        ELEMENT_CHART[atk][def] = val; 
    }
}

// Defaults 1.0
Object.values(ELEMENTS).forEach(a => Object.values(ELEMENTS).forEach(d => setRel(a, d, 1.0)));

// Cycle
setRel(ELEMENTS.WATER, ELEMENTS.FIRE, 2.0);
setRel(ELEMENTS.FIRE, ELEMENTS.WATER, 0.5);

setRel(ELEMENTS.FIRE, ELEMENTS.WIND, 2.0);
setRel(ELEMENTS.WIND, ELEMENTS.FIRE, 0.5);

setRel(ELEMENTS.WIND, ELEMENTS.EARTH, 2.0);
setRel(ELEMENTS.EARTH, ELEMENTS.WIND, 0.5);

setRel(ELEMENTS.EARTH, ELEMENTS.WATER, 2.0);
setRel(ELEMENTS.WATER, ELEMENTS.EARTH, 0.5);

// Light / Dark
setRel(ELEMENTS.LIGHT, ELEMENTS.DARK, 2.0);
setRel(ELEMENTS.DARK, ELEMENTS.LIGHT, 2.0);
setRel(ELEMENTS.LIGHT, ELEMENTS.LIGHT, 0.5);
setRel(ELEMENTS.DARK, ELEMENTS.DARK, 0.5);

// Poison Logic
setRel(ELEMENTS.POISON, ELEMENTS.EARTH, 1.5);
setRel(ELEMENTS.POISON, ELEMENTS.WATER, 1.5);
setRel(ELEMENTS.POISON, ELEMENTS.POISON, 0.0); // Immune
setRel(ELEMENTS.FIRE, ELEMENTS.POISON, 1.5); // Burn poison
setRel(ELEMENTS.WIND, ELEMENTS.POISON, 1.5); // Disperse poison

// Path Definition (Grid Coordinates)
// S-Shape
const PATH_POINTS = [
    {x: 0, y: 2},
    {x: 18, y: 2},
    {x: 18, y: 6},
    {x: 1, y: 6},
    {x: 1, y: 10},
    {x: 18, y: 10},
    {x: 18, y: 14}, // End
];

// --- Global State ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const assets = { marmot: new Image() };
assets.marmot.src = 'https://raw.githubusercontent.com/weber87na/MarmoTD/main/marmot.png';

let game = {
    gold: 600,
    lives: 20,
    wave: 1,
    score: 0,
    speedFactor: 1,
    loopId: null,
    lastTime: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    waveActive: false,
    waveTimer: 0,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    selectedTower: null, // For UI
    mouseX: 0,
    mouseY: 0,
    autoNextWaveTimer: 0, // Auto start timer
    isGameStarted: false,
    foods: [],
    acidRainTimer: 0, // Acid Rain Event
    acidRainTick: 0 // For damage interval
};

// --- Generators ---

// Generate 20 Tower Types
const TOWER_TYPES = [];
const SHAPES = ['circle', 'square', 'triangle', 'pentagon', 'diamond'];
const ELEMENT_KEYS_ORIGINAL = ['NONE', 'LIGHT', 'DARK', 'WATER', 'FIRE', 'WIND', 'EARTH', 'POISON'];

// Custom Tower Names based on ID/Element
const TOWER_NAMES = [
    // Tier 1 (0-7)
    '鐵甲弩砲',   // NONE
    '光輝守衛',   // LIGHT
    '暗影射手',   // DARK
    '寒冰水晶',   // WATER
    '烈焰砲塔',   // FIRE
    '疾風圖騰',   // WIND
    '堅石堡壘',   // EARTH
    '劇毒噴嘴',   // POISON

    // Tier 2 (8-15)
    '重型加農',   // NONE (Cycle back)
    '天堂之拳',   // LIGHT
    '虛空行者',   // DARK
    '深海巨獸',   // WATER
    '隕石術塔',   // FIRE
    '雷神之錘',   // WIND
    '泰坦之握',   // EARTH
    '腐蝕之沼',   // POISON

    // Tier 3 (16-19)
    '毀滅戰車',   // NONE
    '神聖新星',   // LIGHT
    '狙擊精英',   // DARK (Sniper - ID 18)
    '狂暴機槍',   // WATER (Rapid - ID 19)
    '大砲塔',     // NONE (Cannon - ID 20)
    '黑洞塔',     // DARK (BlackHole - ID 21)
    '隨機塔',     // NONE (Random - ID 22)
    '輔助攻速塔', // WIND (Support - ID 23)
    '狂暴塔',     // FIRE (Berserk - ID 24)
    '流星塔'      // LIGHT (Meteor - ID 25)
];

for (let i = 0; i < 20; i++) {
    const elementKey = ELEMENT_KEYS_ORIGINAL[i % 8];
    const element = ELEMENTS[elementKey];
    const tier = Math.floor(i / 8) + 1; // 1, 2, 3 roughly
    
    // Vary stats based on index to create "classes"
    let range = 3 + (i % 5); // 3 to 7 tiles
    let damage = 10 + (i * 2) + (tier * 5);
    let speed = 60 - (i % 3) * 10; // Frames per shot (lower is faster)
    if (speed < 10) speed = 10;
    let cost = 50 + (i * 25);

    // Special types adjustments
    if (i === 18) { // Sniper
        range = 12; damage = 300; speed = 120; cost = 800;
    }
    if (i === 19) { // Rapid
        range = 4; damage = 5; speed = 5; cost = 600;
    }

    let skill = null;
    let skillDesc = '';
    
    // Assign Skills based on Index/Element
    // 0 Light -> Heal
    if (i === 0 || i === 8) { skill = 'heal'; skillDesc = '治療周圍'; }
    // 2 Water -> Slow (Passive)
    else if (element === ELEMENTS.WATER) { skill = 'slow'; skillDesc = '緩速敵人'; }
    // 3 Fire -> Crit (Passive)
    else if (element === ELEMENTS.FIRE) { skill = 'crit'; skillDesc = '暴擊機率'; }
    // 6 Earth -> Gold (Passive)
    else if (element === ELEMENTS.EARTH) { skill = 'gold'; skillDesc = '生產黃金'; }
    // 7 Poison -> Poison (Passive)
    else if (element === ELEMENTS.POISON) { skill = 'poison'; skillDesc = '毒素傷害'; }
    // 18 Sniper -> Nuke (Active)
    else if (i === 18) { skill = 'nuke'; skillDesc = '主動: 核彈'; }

    TOWER_TYPES.push({
        id: i,
        name: TOWER_NAMES[i] || `${element}塔 MK${tier}`, // Use Custom Name
        element: element,
        range: range * TILE_SIZE,
        damage: damage,
        cooldown: speed,
        cost: cost,
        color: ELEMENT_COLORS[element],
        shape: SHAPES[i % SHAPES.length],
        tier: tier,
        skill: skill,
        skillDesc: skillDesc
    });
}

// Add New Special Towers
const SPECIAL_TOWERS = [
    { id: 20, name: '大砲塔', element: ELEMENTS.NONE, range: 5, damage: 50, speed: 90, cost: 250, shape: 'square', skill: 'aoe', desc: '範圍傷害' },
    { id: 21, name: '黑洞塔', element: ELEMENTS.DARK, range: 5, damage: 500, speed: 120, cost: 1000, shape: 'circle', skill: 'blackhole', desc: '極高黑洞傷害' },
    { id: 22, name: '隨機塔', element: ELEMENTS.NONE, range: 4, damage: 20, speed: 60, cost: 500, shape: 'diamond', skill: 'transform', desc: '每10s變身' },
    { id: 23, name: '輔助攻速塔', element: ELEMENTS.WIND, range: 4, damage: 5, speed: 60, cost: 400, shape: 'triangle', skill: 'buff_speed', desc: '增加隊友攻速' },
    { id: 24, name: '狂暴塔', element: ELEMENTS.FIRE, range: 4, damage: 300, speed: 45, cost: 600, shape: 'pentagon', skill: 'berserk', desc: '極高傷/隊友扣血' },
    { id: 25, name: '流星塔', element: ELEMENTS.LIGHT, range: 6, damage: 200, speed: 90, cost: 1000, shape: 'circle', skill: 'meteor', desc: '範圍傷害/金錢' },
    { id: 26, name: '冰封塔', element: ELEMENTS.WATER, range: 4, damage: 30, speed: 60, cost: 800, shape: 'square', skill: 'freeze', desc: '凍結敵人 1秒 (無效BOSS)' },
    { id: 27, name: '貪婪塔', element: ELEMENTS.NONE, range: 5, damage: 1, speed: 60, cost: 3000, shape: 'diamond', skill: 'greed', desc: '0.5%現金傷/每級+0.1%' },
    { id: 28, name: '藤蔓塔', element: ELEMENTS.POISON, range: 4, damage: 40, speed: 45, cost: 900, shape: 'triangle', skill: 'root', desc: '定身BOSS 0.1s/等' },
    { id: 29, name: '戰鼓塔', element: ELEMENTS.FIRE, range: 3, damage: 0, speed: 60, cost: 1200, shape: 'pentagon', skill: 'buff_damage', desc: '增加周圍塔傷害' },
    { id: 30, name: '刀塔', element: ELEMENTS.NONE, range: 1.8, damage: 400, speed: 30, cost: 1500, shape: 'square', skill: 'blade', desc: '短距高傷/殺BOSS' },
    { id: 31, name: '鷹眼塔', element: ELEMENTS.WIND, range: 3, damage: 0, speed: 60, cost: 1200, shape: 'circle', skill: 'buff_crit', desc: '增加周圍塔爆擊' },
    { id: 32, name: '星辰塔', element: ELEMENTS.WIND, range: 100, damage: 20, speed: 120, cost: 2500, shape: 'star', skill: 'starfall', desc: '全場傷/壞食物' },
    { id: 33, name: '路障塔', element: ELEMENTS.EARTH, range: 0.5, damage: 0, speed: 0, cost: 500, shape: 'rect', skill: 'barricade', desc: '路障/接觸傷+緩' },
    { id: 34, name: '毒藥塔', element: ELEMENTS.POISON, range: 4, damage: 40, speed: 60, cost: 1800, shape: 'pentagon', skill: 'spawn_poison', desc: '5%造毒食物' },
    { id: 35, name: '時空塔', element: ELEMENTS.DARK, range: 5, damage: 10, speed: 60, cost: 2500, shape: 'diamond', skill: 'teleport', desc: '機率傳送回溯' },
    { id: 36, name: '商人塔', element: ELEMENTS.NONE, range: 4, damage: 10, speed: 60, cost: 1000, shape: 'square', skill: 'merchant', desc: '幫敵補血/賺錢' }
];

SPECIAL_TOWERS.forEach(t => {
    TOWER_TYPES.push({
        id: t.id,
        name: t.name,
        element: t.element,
        range: t.range * TILE_SIZE,
        damage: t.damage,
        cooldown: t.speed,
        cost: t.cost,
        color: ELEMENT_COLORS[t.element],
        shape: t.shape,
        tier: 3,
        skill: t.skill,
        skillDesc: t.desc
    });
});

// Generate 100 Waves - HARDCORE
const WAVES = [];
for (let i = 0; i < 100; i++) {
    const isBoss = (i + 1) % 5 === 0;
    const elementKey = ELEMENT_KEYS_ORIGINAL[(i + 2) % 8];
    const element = ELEMENTS[elementKey];
    
    // Multi-element Logic: Bosses after level 5 get a second element
    const waveElements = [element];
    if (isBoss && i > 5) {
        // Add the opposing or next element as secondary
        const secondaryKey = ELEMENT_KEYS_ORIGINAL[(i + 5) % 8];
        waveElements.push(ELEMENTS[secondaryKey]);
    }

    // Significantly increased HP scaling
    const baseHP = 150 * Math.pow(1.15, i); // Lowered slightly for 100 levels to prevent infinity
    // Boss Waves now have Minions: 3 Bosses + 10 Minions = 13
    const count = isBoss ? 13 : (10 + Math.floor(i / 2));
    const speed = 1.0 + (i % 3) * 0.5;
    
    WAVES.push({
        level: i + 1,
        elementKey: elementKey,
        element: element, // Primary (for legacy/display mainly)
        elements: waveElements, // All elements
        count: count,
        hp: Math.floor(baseHP * (isBoss ? 10 : 1)), // Boss has 10x HP
        speed: isBoss ? speed * 0.5 : speed, // Boss is slower
        interval: isBoss ? 60 : (60 - Math.min(i, 40)), // Faster interval for boss wave mixed spawn
        reward: (10 + Math.floor(i * 1.5)) * (isBoss ? 10 : 1),
        scale: (0.6 + (i % 4) * 0.1) * (isBoss ? 2.5 : 1), // Boss is huge
        isBoss: isBoss,
        bossCount: 3 // Track how many actual bosses
    });
}
// --- Classes ---

class Enemy {
    constructor(waveIdx, isMinion = false) {
        const config = WAVES[waveIdx];
        
        this.isBoss = config.isBoss && !isMinion;
        this.isMinion = isMinion;

        // Stats Adjustment for Minions in Boss Wave
        if (this.isMinion) {
            this.hp = config.hp / 20; // Weak minions
            this.maxHp = this.hp;
            this.speed = config.speed * 1.5; // Fast minions
            this.scale = 0.5;
            this.reward = Math.floor(config.reward / 20);
        } else {
            this.hp = config.hp;
            this.maxHp = config.hp;
            this.speed = config.speed;
            this.scale = config.scale;
            this.reward = config.reward;
        }

        this.elements = [...config.elements]; 
        this.element = this.elements[0]; 
        
        // Pathing
        this.pathIndex = 0;
        this.x = PATH_POINTS[0].x * TILE_SIZE + TILE_SIZE/2;
        this.y = PATH_POINTS[0].y * TILE_SIZE + TILE_SIZE/2;
        this.targetX = PATH_POINTS[1].x * TILE_SIZE + TILE_SIZE/2;
        this.targetY = PATH_POINTS[1].y * TILE_SIZE + TILE_SIZE/2;
        
        this.frozen = 0; // Slow
        this.frozenHard = 0; // Stop (New)
        this.poisoned = 0;
        this.poisonTimer = 0;
        this.invincible = 0; // Invincibility timer
        
        this.attackCooldown = 0;
        this.revived = false; // 5% chance flag
        this.bossSpawnTimer = 0; // Boss summon skill
    }

    update() {
        // Status Effects
        let currentSpeed = this.speed * game.speedFactor;
        
        // Acid Rain Effect: 5% Slow
        if (game.acidRainTimer > 0) {
            currentSpeed *= 0.95;
        }

        if (this.frozenHard > 0) {
            currentSpeed = 0; // Complete stop
            this.frozenHard -= game.speedFactor; // Decrement frames
            // Visual effect? Blue tint is handled in draw maybe
        } else if (this.frozen > 0) {
            currentSpeed *= 0.5;
            this.frozen--;
        }
        
        // Invincibility
        if (this.invincible > 0) {
            this.invincible -= game.speedFactor;
        }
        
        // Regen
        if (this.hp < this.maxHp && Math.random() < 0.01) {
             this.hp += this.maxHp * 0.005;
             if(this.hp > this.maxHp) this.hp = this.maxHp;
        }

        if (this.poisoned > 0) {
            if (this.poisonTimer % 60 === 0) {
                this.hp -= this.poisoned; // damage per second
                game.particles.push(new TextParticle(this.x, this.y, `-${this.poisoned}`, '#76FF03'));
            }
            this.poisonTimer++;
            if (this.hp <= 0) this.die();
        }

        // Attack Nearby Towers (Some enemies)
        // Check for tower in range (e.g., 2 tiles)
        if (this.attackCooldown > 0) this.attackCooldown -= game.speedFactor;
        
        // Simple Logic: If a tower is very close, attack it instead of moving full speed?
        // Or attack while moving. Let's attack while moving.
        if (this.attackCooldown <= 0) {
            const nearbyTower = game.towers.find(t => {
                const dx = t.x - this.x;
                const dy = t.y - this.y;
                return Math.sqrt(dx*dx + dy*dy) < TILE_SIZE * 2;
            });
            
            if (nearbyTower) {
                // Attack!
                let attackDmg = 10 * (this.isBoss ? 5 : 1); // Boss hits hard
                if (game.enemyDamageMultiplier) attackDmg *= game.enemyDamageMultiplier; // Random event
                nearbyTower.takeDamage(attackDmg); 
                game.projectiles.push(new Projectile(this.x, this.y, nearbyTower, 0, this.element, 5)); // Visual only
                this.attackCooldown = 60; // 1 sec attack rate
            }
        }

        // Boss Skill: Summon Minion (Every 5s, 10% chance)
        if (this.isBoss) {
            this.bossSpawnTimer += game.speedFactor;
            if (this.bossSpawnTimer >= 450) { // 5 seconds (90 FPS * 5)
                this.bossSpawnTimer = 0;
                if (Math.random() < 0.1) { // 10% Chance
                    // Spawn Minion
                    // We use current wave config. 
                    // Note: game.wave is 1-based, array is 0-based.
                    // If wave is active, game.wave is correct.
                    const waveIdx = Math.max(0, game.wave - 1);
                    const minion = new Enemy(waveIdx, true);
                    
                    // Sync Position
                    minion.x = this.x;
                    minion.y = this.y;
                    minion.pathIndex = this.pathIndex;
                    minion.targetX = this.targetX;
                    minion.targetY = this.targetY;
                    
                    // Add to game
                    game.enemies.push(minion);
                    game.particles.push(new TextParticle(this.x, this.y - 40, "召喚!", '#ff00ff'));
                }
            }
        }

        // Movement
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist <= currentSpeed) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.pathIndex++;
            if (this.pathIndex >= PATH_POINTS.length - 1) {
                this.reachEnd();
            } else {
                this.targetX = PATH_POINTS[this.pathIndex + 1].x * TILE_SIZE + TILE_SIZE/2;
                this.targetY = PATH_POINTS[this.pathIndex + 1].y * TILE_SIZE + TILE_SIZE/2;
            }
        } else {
            this.x += (dx / dist) * currentSpeed;
            this.y += (dy / dist) * currentSpeed;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Health Bar
        const pct = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = 'red';
        ctx.fillRect(-15, -25, 30, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-15, -25, 30 * pct, 4);

        // Marmot
        const size = 32 * this.scale;
        
        // Elemental Aura / Glow
        ctx.shadowBlur = 15;
        
        if (this.elements.length > 1) {
            // Gradient for multi-element
            const grad = ctx.createLinearGradient(-size/2, -size/2, size/2, size/2);
            this.elements.forEach((elem, idx) => {
                grad.addColorStop(idx / (this.elements.length - 1), ELEMENT_COLORS[elem]);
            });
            ctx.strokeStyle = grad;
            ctx.shadowColor = ELEMENT_COLORS[this.elements[0]]; // Shadow defaults to primary
        } else {
            ctx.shadowColor = ELEMENT_COLORS[this.element];
            ctx.strokeStyle = ctx.shadowColor;
        }

        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(0, 0, size/1.5, 0, Math.PI*2);
        ctx.stroke();
        
        ctx.shadowBlur = 0; // Reset

        // Boss Indicator
        if (this.isBoss) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 5; // Thicker for boss
            ctx.stroke();
        }

        // Invincible Aura
        if (this.invincible > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, size/1.2, 0, Math.PI*2);
            ctx.strokeStyle = '#FFD700'; // Gold
            ctx.lineWidth = 4;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
        }

        // Draw Image
        if (assets.marmot.complete) {
            ctx.drawImage(assets.marmot, -size/2, -size/2, size, size);
        }

        ctx.restore();
    }
// ... (rest of class)

    takeDamage(amount, type, sourceTower = null) {
        if (this.invincible > 0) {
            game.particles.push(new TextParticle(this.x, this.y - 10, "無敵!", '#FFD700'));
            return;
        }

        let mult = 1.0;
        // Calculate cumulative multiplier
        this.elements.forEach(elem => {
            mult *= (ELEMENT_CHART[type][elem] || 1.0);
        });

        const finalDmg = amount * mult;
        this.hp -= finalDmg;
        
        // Visual text
        let color = '#fff';
        if (mult > 1.2) color = '#ff0000'; // Crit
        else if (mult < 0.8) color = '#888'; // Weak
        
        if (game.particles.length < 50) { // Limit particles
            game.particles.push(new TextParticle(this.x, this.y - 10, Math.floor(finalDmg), color));
        }

        if (this.hp <= 0) this.die(sourceTower);
    }

    die(killer = null) {
        // Resurrection Logic (5%)
        if (!this.revived && !this.isMinion && !this.isSplit && Math.random() < 0.05) {
            this.revived = true;
            this.hp = this.maxHp * 2;
            this.maxHp = this.hp;
            this.dead = false; 
            game.particles.push(new TextParticle(this.x, this.y - 30, "復活!", '#00ffff'));
            showNotification("怪物復活! 血量加倍!");
            return;
        }

        // Split Logic (5%) - Only if not already a split/minion/boss
        // Let's allow Bosses to split into mini-bosses too? Maybe too hard.
        // Rule: 5% chance to spawn a new enemy with 50% HP.
        if (!this.isMinion && !this.isSplit && !this.revived && Math.random() < 0.05) {
             const split = new Enemy(game.wave - 1, true); // Use minion flag for stats base
             // Custom override
             split.x = this.x;
             split.y = this.y;
             split.pathIndex = this.pathIndex;
             split.targetX = this.targetX;
             split.targetY = this.targetY;
             split.hp = this.maxHp * 0.5;
             split.maxHp = split.hp;
             split.scale = this.scale * 0.8;
             split.isSplit = true; // Mark as split to prevent infinite chain
             
             game.enemies.push(split);
             game.particles.push(new TextParticle(this.x, this.y - 30, "分裂!", '#ff00ff'));
        }

        this.dead = true;
        
        // Extra Gold for Greed Tower Kill
        let extraGold = 0;
        if (killer && killer.skill === 'greed') {
            extraGold = Math.floor(this.reward * 0.5); // Bonus 50%
            game.particles.push(new TextParticle(this.x, this.y - 40, `+$${extraGold}`, '#ffd700'));
        }

        game.gold += this.reward + extraGold;
        game.score += this.reward * 10;
        
        // Silence On Death Logic
        // 5% chance for normal enemies, 100% for Bosses
        if ((this.isBoss || Math.random() < 0.05) && game.towers.length > 0) {
            // Silence 1 to 3 towers
            const count = Math.floor(Math.random() * 3) + 1;
            // Get active non-silenced towers
            const validTowers = game.towers.filter(t => !t.dead && t.silenced <= 0);
            
            for (let i = 0; i < count; i++) {
                if (validTowers.length === 0) break;
                const idx = Math.floor(Math.random() * validTowers.length);
                const t = validTowers[idx];
                
                t.silenced = 270; // 3 seconds @ 90 FPS
                game.particles.push(new TextParticle(t.x, t.y - 40, "沉默!", '#cccccc'));
                
                // Remove to prevent double picking
                validTowers.splice(idx, 1);
            }
        }

        updateUI();
    }

    reachEnd() {
        this.dead = true;
        game.lives--;
        updateUI();
        if (game.lives <= 0) gameOver();
    }
}

class Tower {
    constructor(typeId, x, y) {
        const type = TOWER_TYPES[typeId];
        this.typeId = typeId;
        this.gridX = x;
        this.gridY = y;
        this.x = x * TILE_SIZE + TILE_SIZE/2;
        this.y = y * TILE_SIZE + TILE_SIZE/2;
        
        this.level = 1;
        this.spent = type.cost;
        this.kills = 0;
        
        // Stats
        this.baseDamage = type.damage;
        this.baseRange = type.range;
        this.baseCooldown = type.cooldown;
        this.element = type.element;
        this.shape = type.shape;
        this.color = type.color;
        this.skill = type.skill;
        
        this.cooldownTimer = 0;
        this.skillTimer = 0; // For passive skills
        this.activeSkillCd = 0; // For active skills

        // Status Effects
        this.silenced = 0; // Timer for silence

        // New properties for special towers
        this.transformTimer = 0;
        this.attackSpeedMultiplier = 1.0;
        this.damageMultiplier = 1.0;
        this.critChanceBonus = 0.0;
        
        // Barricade Logic
        this.trappedEnemies = []; // List of enemies currently on the trap

        // Health Logic
        if (typeId === 33) {
            this.maxHp = 100; // Lower HP for Barricade
        } else {
            this.maxHp = 100 * type.tier;
        }
        this.hp = this.maxHp;
        this.dead = false;
    }

    getDamage() { 
        let dmg = this.baseDamage * Math.pow(1.5, this.level - 1);
        return Math.floor(dmg * this.damageMultiplier);
    }
    
    // Sell Value depends on HP
    getCost() { 
        const baseSell = Math.floor(this.spent * 0.7);
        const hpPct = this.hp / this.maxHp;
        return Math.floor(baseSell * hpPct);
    }
    
    getUpgradeCost() { return Math.floor(TOWER_TYPES[this.typeId].cost * Math.pow(1.5, this.level)); }

    takeDamage(amount) {
        this.hp -= amount;
        game.particles.push(new TextParticle(this.x, this.y - 20, `-${amount}`, '#ff0000'));
        if (this.hp <= 0) {
            this.dead = true;
            game.selectedTower = null; // Deselect if selected
            document.getElementById('selection-info').style.display = 'none';
        }
    }
    
    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
        game.particles.push(new TextParticle(this.x, this.y - 20, `+${amount}`, '#00ff00'));
    }

    morph() {
        // Morph into random tower (excluding Random Tower ID 22)
        let newId = Math.floor(Math.random() * TOWER_TYPES.length);
        if (newId === 22) newId = 0; // Fallback
        
        const type = TOWER_TYPES[newId];
        this.typeId = newId;
        this.baseDamage = type.damage;
        this.baseRange = type.range;
        this.baseCooldown = type.cooldown;
        this.element = type.element;
        this.shape = type.shape;
        this.color = type.color;
        this.skill = type.skill;
        
        // Reset some state
        this.transformTimer = 0;
        game.particles.push(new TextParticle(this.x, this.y - 30, "變身!", '#ffffff'));
        if (game.selectedTower === this) updateTowerInfo();
    }

    triggerActiveSkill() {
        if (this.silenced > 0) {
            showNotification("防禦塔已被沉默，無法施放技能!");
            return false;
        }

        if (this.skill === 'nuke' && this.activeSkillCd <= 0) {
             // Find strongest enemy
             let target = null;
             let maxHp = -1;
             for (const enemy of game.enemies) {
                 if (enemy.hp > maxHp) {
                     maxHp = enemy.hp;
                     target = enemy;
                 }
             }
             
             if (target) {
                 target.takeDamage(500 * this.level, this.element); // Massive Damage
                 game.particles.push(new TextParticle(target.x, target.y - 30, "核彈!", '#ff00ff'));
                 // Visual beam
                 game.projectiles.push(new Projectile(this.x, this.y, target, 0, this.element, 20)); 
                 this.activeSkillCd = 600; // 10s cooldown
                 updateTowerInfo(); // Update button state
                 return true;
             } else {
                 showNotification("沒有可攻擊的目標!");
                 return false;
             }
        }
        return false;
    }

    update() {
        if (this.dead) return;
        
        // Passive Regen
        if (this.hp < this.maxHp && Math.random() < 0.01) this.hp++;
        
        // Silence Effect
        if (this.silenced > 0) {
            this.silenced -= game.speedFactor;
            // Visual particle occasionally
            if (this.silenced % 60 === 0) {
                game.particles.push(new TextParticle(this.x, this.y - 30, "...", '#888'));
            }
            // Can't shoot or use skills
            return;
        }

        // Active Skill CD
        if (this.activeSkillCd > 0) {
             this.activeSkillCd -= game.speedFactor;
             if (this.activeSkillCd < 0) this.activeSkillCd = 0;
             if (game.selectedTower === this && this.activeSkillCd === 0) updateTowerInfo();
        }

        // --- Special Tower Logic ---
        
        // Random Tower: Transform
        if (this.skill === 'transform') {
            this.transformTimer += game.speedFactor;
            if (this.transformTimer >= 900) { // 10s @ 90fps
                this.morph();
            }
        }

        // Support Tower: Buff neighbors
        // Reset multipliers first
        this.attackSpeedMultiplier = 1.0;
        this.damageMultiplier = 1.0;
        this.critChanceBonus = 0.0;
        
        // Look for buffers nearby
        for (const other of game.towers) {
            if (other !== this && !other.dead) {
                const dist = Math.sqrt((other.x - this.x)**2 + (other.y - this.y)**2);
                
                if (dist <= other.baseRange) {
                    if (other.skill === 'buff_speed') {
                        this.attackSpeedMultiplier = 2.0; // Double speed (non-stacking logic for simplicity)
                    }
                    if (other.skill === 'buff_damage') {
                        this.damageMultiplier = 1.5; // +50% Damage
                    }
                    if (other.skill === 'buff_crit') {
                        this.critChanceBonus = 0.3; // +30% Crit Chance
                    }
                }
            }
        }

        // Passive Skills Logic
        this.skillTimer += game.speedFactor;
        
        if ((this.skill === 'gold' || this.skill === 'meteor') && this.skillTimer >= 450) { // 5s @ 90fps
            game.gold += 10;
            game.particles.push(new TextParticle(this.x, this.y - 20, `+$10`, '#ffd700'));
            this.skillTimer = 0;
            updateUI();
        }
        
        // Time Tower Logic (Teleport)
        if (this.skill === 'teleport') {
            // Base Period: 10s. Reduce by 1s per level. Min 1s.
            let periodSec = 10 - (this.level - 1);
            if (periodSec < 1) periodSec = 1;
            const periodFrames = periodSec * FPS;

            if (this.skillTimer >= periodFrames) {
                this.skillTimer = 0;
                
                // Roll Chance: Random 1% ~ 10% + (Level)%
                const baseChance = Math.random() * 9 + 1; // 1 to 10
                const finalChance = baseChance + (this.level); 
                
                if (Math.random() * 100 < finalChance) {
                    // Trigger Teleport
                    // Find target: Random enemy in range
                    const candidates = game.enemies.filter(e => {
                        const dist = Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2);
                        return dist <= this.baseRange && !e.dead && !e.isBoss; // Cannot teleport Boss? Let's say yes for now, maybe user wants Boss teleport too. 
                        // Prompt said "Teleport marmot". Boss is marmot. But Boss teleport might be too OP or buggy? 
                        // Let's allow it but maybe limit distance or make immune?
                        // User didn't say immune. Let's allow.
                    });
                    
                    if (candidates.length > 0) {
                        const target = candidates[Math.floor(Math.random() * candidates.length)];
                        
                        // Teleport back 5 steps
                        let newIdx = target.pathIndex - 5;
                        if (newIdx < 0) newIdx = 0;
                        
                        target.pathIndex = newIdx;
                        // Reset pos to new path point
                        const p = PATH_POINTS[Math.min(newIdx, PATH_POINTS.length-1)];
                        target.x = p.x * TILE_SIZE + TILE_SIZE/2;
                        target.y = p.y * TILE_SIZE + TILE_SIZE/2;
                        
                        // Recalculate target
                        if (newIdx < PATH_POINTS.length - 1) {
                            target.targetX = PATH_POINTS[newIdx + 1].x * TILE_SIZE + TILE_SIZE/2;
                            target.targetY = PATH_POINTS[newIdx + 1].y * TILE_SIZE + TILE_SIZE/2;
                        } else {
                            // At end (shouldn't happen if we move back, but safe check)
                            target.targetX = target.x;
                            target.targetY = target.y;
                        }
                        
                        game.particles.push(new TextParticle(target.x, target.y - 30, "時空回溯!", '#9C27B0')); // Purple
                        // Visual beam
                        ctx.strokeStyle = '#9C27B0';
                        ctx.beginPath();
                        ctx.moveTo(this.x, this.y);
                        ctx.lineTo(target.x, target.y);
                        ctx.stroke();
                    }
                }
            }
        }

        if (this.skill === 'heal' && this.skillTimer >= 90) { // 1s
            // Find damaged neighbor
            const neighbor = game.towers.find(t => t !== this && !t.dead && t.hp < t.maxHp && 
                Math.sqrt((t.x-this.x)**2 + (t.y-this.y)**2) <= TILE_SIZE * 3);
            
            if (neighbor) {
                neighbor.heal(5 * this.level);
                // Visual line?
            }
            this.skillTimer = 0;
        }

        if (this.cooldownTimer > 0) {
            // Apply speed buff
            let speedMult = this.attackSpeedMultiplier;
            
            // Acid Rain Effect: 10% Slower Attack (so multiplier decreases)
            if (game.acidRainTimer > 0) {
                speedMult *= 0.9;
            }

            this.cooldownTimer -= game.speedFactor * speedMult;
            return;
        }

        // --- Poison Tower Logic (Spawn Poison Food) ---
        if (this.skill === 'spawn_poison') {
            // Logic: Check every ~1 second (90 frames)
            // But update runs every frame. We can reuse skillTimer.
            this.skillTimer += game.speedFactor;
            if (this.skillTimer >= 90) { // Every 1 second attempt
                if (Math.random() < 0.05) { // 5% Chance
                    // Spawn Poison Food
                    const segIdx = Math.floor(Math.random() * (PATH_POINTS.length - 1));
                    const p1 = PATH_POINTS[segIdx];
                    const p2 = PATH_POINTS[segIdx+1];
                    const t = Math.random();
                    const fx = (p1.x + (p2.x - p1.x) * t) * TILE_SIZE + TILE_SIZE/2;
                    const fy = (p1.y + (p2.y - p1.y) * t) * TILE_SIZE + TILE_SIZE/2;
                    
                    game.foods.push(new Food(fx, fy, 'poison'));
                    game.particles.push(new TextParticle(this.x, this.y - 20, "製毒!", '#C6FF00'));
                }
                this.skillTimer = 0;
            }
            // Poison tower also shoots normally, so we fall through to shooting logic
        }

        // --- Starfall Tower Logic (Global Attack) ---
        if (this.skill === 'starfall') {
            // Attack ALL enemies
            game.enemies.forEach(e => {
                game.projectiles.push(new Projectile(this.x, this.y, e, this.getDamage(), this.element, 20, false, null, this));
            });
            // Food Destruction
            // 15% chance to destroy a food item if any exist
            if (game.foods.length > 0 && Math.random() < 0.15) {
                const fIdx = Math.floor(Math.random() * game.foods.length);
                const f = game.foods[fIdx];
                f.life = 0; // Destroy
                game.particles.push(new TextParticle(f.x, f.y, "食物破壞!", '#555'));
            }
            
            this.cooldownTimer = this.baseCooldown;
            return;
        }

        // --- Barricade Logic (Trap) ---
        if (this.skill === 'barricade') {
            // Detect enemies on the same tile (approx < 20 px dist)
            // We use a list to track entered enemies so we only hit them once per entry
            
            // Clean up list for dead/far enemies
            this.trappedEnemies = this.trappedEnemies.filter(e => 
                !e.dead && Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2) < TILE_SIZE
            );

            game.enemies.forEach(e => {
                const dist = Math.sqrt((e.x - this.x)**2 + (e.y - this.y)**2);
                if (dist < TILE_SIZE * 0.5) { // Close contact
                    if (!this.trappedEnemies.includes(e)) {
                        // Trigger Trap
                        this.trappedEnemies.push(e);
                        
                        // Damage Calculation: 20~50 + 20 per level (Nerfed)
                        const min = 20 + (this.level - 1) * 20;
                        const max = 50 + (this.level - 1) * 20;
                        const dmg = Math.floor(min + Math.random() * (max - min));
                        
                        e.takeDamage(dmg, this.element, this);
                        e.frozen = 120; // Slow 2s
                        
                        game.particles.push(new TextParticle(this.x, this.y - 10, "路障!", '#8D6E63'));
                        
                        // Barricade takes damage? (Optional, maybe later)
                        // this.takeDamage(10);
                    }
                }
            });
            return; // No shooting
        }

        // Find Target
        // Simple logic: First enemy in range
        let target = null;
        let maxDist = 0; // Progress

        for (const enemy of game.enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist <= this.baseRange) {
                target = enemy;
                break; 
            }
        }

        if (target) {
            this.shoot(target);
            this.cooldownTimer = this.baseCooldown;
        }
    }

    shoot(target) {
        let dmg = this.getDamage();
        let isCrit = false;
        
        let critChance = 0.0;
        if (this.skill === 'crit') critChance += 0.25;
        critChance += this.critChanceBonus;

        if (Math.random() < critChance) { 
            dmg *= 2;
            isCrit = true;
        }
        
        // Blade Tower Logic
        if (this.skill === 'blade') {
            if (target.isBoss) {
                dmg *= 3; // 3x Damage to Bosses
                game.particles.push(new TextParticle(this.x, this.y - 20, "斬殺!", '#ff0000'));
            }
        }

        // Greed Tower Damage Logic: 
        // 0.5% of current Gold + 0.1% per level
        if (this.skill === 'greed') {
            const pct = 0.005 + ((this.level - 1) * 0.001);
            dmg = Math.floor(game.gold * pct);
            // Cap minimum damage
            if (dmg < 10) dmg = 10;
        }

        // Berserk Logic: Drain ally HP
        if (this.skill === 'berserk') {
            const neighbor = game.towers.find(t => t !== this && !t.dead && 
                Math.sqrt((t.x-this.x)**2 + (t.y-this.y)**2) <= TILE_SIZE * 2);
            if (neighbor) {
                neighbor.takeDamage(10); // Sacrifice
                game.particles.push(new TextParticle(neighbor.x, neighbor.y - 10, "獻祭", '#880000'));
            }
        }

        game.projectiles.push(new Projectile(
            this.x, this.y, target, dmg, this.element, 8, isCrit, this.skill, this
        ));
    }

    draw() {
        const cx = this.x;
        const cy = this.y;
        
        ctx.fillStyle = '#222';
        ctx.fillRect(this.gridX * TILE_SIZE, this.gridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        ctx.save();
        ctx.translate(cx, cy);
        
        // Base
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        if (this.shape === 'circle') ctx.arc(0,0, 15, 0, Math.PI*2);
        else if (this.shape === 'square') ctx.rect(-12,-12, 24, 24);
        else if (this.shape === 'triangle') {
            ctx.moveTo(0, -15); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath();
        } 
        else if (this.shape === 'diamond') {
            ctx.moveTo(0, -15); ctx.lineTo(12, 0); ctx.lineTo(0, 15); ctx.lineTo(-12, 0); ctx.closePath();
        }
        else if (this.shape === 'star') { // Starfall
            ctx.moveTo(0,-15); ctx.lineTo(4,-4); ctx.lineTo(15,-4); ctx.lineTo(6,4);
            ctx.lineTo(9,15); ctx.lineTo(0,8); ctx.lineTo(-9,15); ctx.lineTo(-6,4);
            ctx.lineTo(-15,-4); ctx.lineTo(-4,-4); ctx.closePath();
        }
        else if (this.shape === 'rect') { // Barricade
            ctx.rect(-18, -8, 36, 16); // Wide rectangle
            ctx.moveTo(-10, -8); ctx.lineTo(-10, 8);
            ctx.moveTo(10, -8); ctx.lineTo(10, 8); // Stripes
        }
        else {
            ctx.rect(-10,-10, 20, 20); // Default
        }
        ctx.fill();
        ctx.stroke();

        // Level Indicators
        ctx.fillStyle = 'gold';
        for(let i=0; i<this.level; i++) {
            ctx.fillRect(-10 + (i*4), -5, 2, 10);
        }

        // HP Bar (if damaged)
        if (this.hp < this.maxHp) {
            const pct = Math.max(0, this.hp / this.maxHp);
            ctx.fillStyle = 'red';
            ctx.fillRect(-15, 15, 30, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(-15, 15, 30 * pct, 4);
        }

        // Silenced Indicator
        if (this.silenced > 0) {
            ctx.fillStyle = 'rgba(50, 50, 50, 0.7)';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText("X", 0, 0);
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, target, damage, element, speed, isCrit = false, skillEffect = null, sourceTower = null) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.element = element;
        this.speed = speed;
        this.isCrit = isCrit;
        this.skillEffect = skillEffect;
        this.sourceTower = sourceTower;
        this.dead = false;
    }

    update() {
        if (this.target.dead) {
            this.dead = true;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const move = this.speed * game.speedFactor;

        if (dist <= move) {
            
            // Merchant Tower Logic: Heal & Earn
            if (this.skillEffect === 'merchant') {
                // Heal
                this.target.hp += this.damage;
                if (this.target.hp > this.target.maxHp) this.target.hp = this.target.maxHp;
                
                // Earn
                game.gold += this.damage;
                
                // Visuals
                game.particles.push(new TextParticle(this.target.x, this.target.y - 20, `+HP`, '#00ff00'));
                if (this.sourceTower) {
                    game.particles.push(new TextParticle(this.sourceTower.x, this.sourceTower.y - 30, `+$${this.damage}`, '#ffd700'));
                }
                updateUI();
            } else {
                // Standard Damage
                this.target.takeDamage(this.damage, this.element, this.sourceTower);
                
                // AOE Logic
                if (this.skillEffect === 'aoe' || this.skillEffect === 'blackhole' || this.skillEffect === 'meteor') {
                    const radius = this.skillEffect === 'blackhole' ? 150 : (this.skillEffect === 'meteor' ? 120 : 100);
                    game.enemies.forEach(e => {
                        if (e !== this.target && !e.dead) {
                            const d = Math.sqrt((e.x - this.target.x)**2 + (e.y - this.target.y)**2);
                            if (d <= radius) {
                                e.takeDamage(this.damage * (this.skillEffect === 'blackhole' ? 0.8 : 0.5), this.element, this.sourceTower);
                            }
                        }
                    });
                    // Visual Effect
                    game.particles.push(new TextParticle(this.target.x, this.target.y - 20, "BOOM!", this.element === '暗' ? '#000' : '#ffa500'));
                }
            }

            if (this.isCrit) {
                 game.particles.push(new TextParticle(this.target.x, this.target.y - 15, "暴擊!", '#ff0000'));
            }
            this.dead = true;
            
            // Special Effects based on Element/Skill
            if (this.element === ELEMENTS.WATER || this.skillEffect === 'slow') this.target.frozen = 60; // Slow 1s
            
            // Fix: Ice Tower only freezes minions
            if (this.skillEffect === 'freeze') {
                if (!this.target.isBoss) {
                    this.target.frozenHard = 60; // Freeze 1s (Stop)
                } else {
                    game.particles.push(new TextParticle(this.target.x, this.target.y - 10, "免疫!", '#aaa'));
                }
            }
            
            // Vine Tower Logic: Roots Bosses
            if (this.skillEffect === 'root') {
                if (this.target.isBoss) {
                    // 0.1s + 0.1s per level
                    // Base level is 1. Duration = (0.1 + (level-1)*0.1)
                    // Simplified: level * 0.1
                    const level = this.sourceTower ? this.sourceTower.level : 1;
                    const durationSec = level * 0.1;
                    this.target.frozenHard = Math.floor(durationSec * FPS); // Stop movement
                    game.particles.push(new TextParticle(this.target.x, this.target.y - 30, "纏繞!", '#00ff00'));
                }
            }

            if (this.element === ELEMENTS.POISON || this.skillEffect === 'poison') {
                this.target.poisoned = 20; // Dmg/sec
                this.target.poisonTimer = 0;
            }

        } else {
            this.x += (dx/dist) * move;
            this.y += (dy/dist) * move;
        }
    }

    draw() {
        ctx.fillStyle = ELEMENT_COLORS[this.element];
        ctx.beginPath();
        const size = this.isCrit ? 6 : 4;
        ctx.arc(this.x, this.y, size, 0, Math.PI*2);
        ctx.fill();
    }
}

class TextParticle {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 30;
    }
    update() {
        this.y -= 1 * game.speedFactor;
        this.life -= game.speedFactor;
    }
    draw() {
        ctx.globalAlpha = this.life / 30;
        ctx.fillStyle = this.color;
        ctx.font = '12px Arial';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Food {
    constructor(x, y, type = null) {
        this.x = x;
        this.y = y;
        
        if (type) {
            this.type = type;
        } else {
            const roll = Math.random();
            // 45% Heal, 45% Speed, 10% Star
            if (roll < 0.45) this.type = 'heal';
            else if (roll < 0.90) this.type = 'speed';
            else this.type = 'star';
        }
        
        this.life = 600; // 10 seconds approx
    }
    
    update() {
        this.life -= game.speedFactor;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Bobbing effect
        const bob = Math.sin(Date.now() / 200) * 3;
        
        if (this.type === 'heal') {
            ctx.fillStyle = '#ff4444';
            // Heart shape
            ctx.beginPath();
            ctx.moveTo(0, -5 + bob);
            ctx.bezierCurveTo(-5, -10 + bob, -10, -5 + bob, 0, 5 + bob);
            ctx.bezierCurveTo(10, -5 + bob, 5, -10 + bob, 0, -5 + bob);
            ctx.fill();
        } else if (this.type === 'speed') {
            ctx.fillStyle = '#4488ff';
            // Bolt shape
            ctx.beginPath();
            ctx.moveTo(2, -8 + bob);
            ctx.lineTo(-4, 0 + bob);
            ctx.lineTo(0, 0 + bob);
            ctx.lineTo(-2, 8 + bob);
            ctx.lineTo(4, 0 + bob);
            ctx.lineTo(0, 0 + bob);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'star') { // Star
            ctx.fillStyle = '#FFD700';
            // Star shape
            ctx.beginPath();
            const spikes = 5;
            const outerRadius = 8;
            const innerRadius = 4;
            let rot = Math.PI / 2 * 3;
            let x = 0; let y = 0;
            let step = Math.PI / spikes;

            ctx.moveTo(0, -outerRadius + bob);
            for (let i = 0; i < spikes; i++) {
                x = 0 + Math.cos(rot) * outerRadius;
                y = 0 + bob + Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = 0 + Math.cos(rot) * innerRadius;
                y = 0 + bob + Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.lineTo(0, -outerRadius + bob);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'poison') {
            ctx.fillStyle = '#C6FF00'; // Lime/Poison Green
            ctx.strokeStyle = '#550055';
            ctx.lineWidth = 2;
            
            // Skull-like or Cross shape
            ctx.beginPath();
            ctx.arc(0, -2 + bob, 8, 0, Math.PI*2); // Head
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#550055'; // Eyes
            ctx.beginPath();
            ctx.arc(-3, -4 + bob, 2, 0, Math.PI*2);
            ctx.arc(3, -4 + bob, 2, 0, Math.PI*2);
            ctx.fill();
            
            // Crossbones
            ctx.strokeStyle = '#C6FF00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-6, 6 + bob); ctx.lineTo(6, -6 + bob);
            ctx.moveTo(-6, -6 + bob); ctx.lineTo(6, 6 + bob);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// --- Engine ---

function init() {
    // Generate UI
    const list = document.getElementById('towers-list');
    TOWER_TYPES.forEach(t => {
        const div = document.createElement('div');
        div.className = 'tower-card';
        div.innerHTML = `
            <div class="tower-icon" style="background:${t.color}; border-radius:50%;"></div>
            <strong>${t.name.split(' ')[0]}</strong>
            <span class="element-badge" style="background:${t.color}33;">${t.element}</span>
            <div style="margin-top:2px;">$${t.cost}</div>
        `;
        div.onclick = () => selectTowerToBuild(t.id);
        div.onmouseenter = (e) => showTooltip(t, e);
        div.onmouseleave = () => hideTooltip();
        div.onmousemove = (e) => moveTooltip(e); // Follow mouse
        list.appendChild(div);
    });

    // Event Listeners
    canvas.addEventListener('mousedown', onCanvasClick);
    document.getElementById('start-wave-btn').addEventListener('click', startNextWave);
    document.getElementById('speed-btn').addEventListener('click', toggleSpeed);
    document.getElementById('upgrade-btn').addEventListener('click', upgradeSelected);
    document.getElementById('sell-btn').addEventListener('click', sellSelected);
    
    // Mouse Move for Cursor
    canvas.addEventListener('mousemove', onCanvasMouseMove);

    // Initial Draw
    updateUI();
    draw();
    
    // Start Loop
    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!game.lastTime) game.lastTime = timestamp;
    const delta = timestamp - game.lastTime;

    if (delta >= 1000 / (FPS * (game.speedFactor === 2 ? 2 : 1))) {
        update();
        draw();
        game.lastTime = timestamp;
    }
    
    game.loopId = requestAnimationFrame(gameLoop);
}

function update() {
    if (game.lives <= 0) return;

    // Acid Rain Logic
    if (game.acidRainTimer > 0) {
        game.acidRainTimer -= game.speedFactor;
        game.acidRainTick += game.speedFactor;
        
        // Damage every 1 second (approx 90 frames)
        if (game.acidRainTick >= 90) {
            game.acidRainTick = 0;
            // 2 ~ 5 damage (Nerfed from 10~30)
            const acidDmg = 2 + Math.floor(Math.random() * 4);
            
            game.towers.forEach(t => {
                if (!t.dead) {
                    t.hp -= acidDmg;
                    if (t.hp <= 0) {
                        t.dead = true;
                        game.particles.push(new TextParticle(t.x, t.y - 20, "溶解!", '#888'));
                    } else {
                        // Less particle spam, maybe only 10% chance to show text per tower
                        if (Math.random() < 0.1) {
                            game.particles.push(new TextParticle(t.x, t.y - 20, `-${acidDmg}`, '#ccff00'));
                        }
                    }
                }
            });
        }
        
        // Random visual rain particle
        if (Math.random() < 0.3) {
             const rx = Math.random() * CANVAS_WIDTH;
             const ry = Math.random() * CANVAS_HEIGHT;
             game.particles.push(new TextParticle(rx, ry, "|", '#ccff00'));
        }
    }


    // Wave Spawning
    if (game.waveActive) {
        if (game.enemiesToSpawn > 0) {
            game.spawnTimer -= game.speedFactor;
            if (game.spawnTimer <= 0) {
                const config = WAVES[game.wave - 1];
                let isMinion = false;
                
                // Logic for Boss Wave Mixing
                if (config.isBoss) {
                    // We spawn 3 Bosses total. The rest are minions.
                    // Total count is bossCount + minionCount.
                    // Let's say Bosses appear at the END or interspersed?
                    // Simple: Random chance if Bosses remaining > 0, else Minion
                    // Or deterministic: Bosses are last 3.
                    
                    // We tracked how many bosses spawned? No, we only track enemiesToSpawn.
                    // game.enemiesToSpawn counts down.
                    // If enemiesToSpawn <= 3, force boss.
                    // But we want to mix them? 
                    // Let's do: 3 Bosses. Count = 13.
                    // If enemiesToSpawn <= 3, it's a Boss.
                    // Else it's a minion.
                    // This puts Bosses at the end which is dramatic.
                    if (game.enemiesToSpawn > config.bossCount) {
                        isMinion = true;
                    }
                }

                game.enemies.push(new Enemy(game.wave - 1, isMinion));
                game.enemiesToSpawn--;
                game.spawnTimer = config.interval;
            }
        } else if (game.enemies.length === 0) {
            endWave();
        }
    } else if (game.isGameStarted && game.autoNextWaveTimer > 0) {
        // Auto Next Wave Countdown
        game.autoNextWaveTimer -= (1 / FPS) * game.speedFactor;
        if (game.autoNextWaveTimer <= 0) {
            game.autoNextWaveTimer = 0;
            startNextWave();
        } else {
            // Update UI for Countdown
             const btn = document.getElementById('start-wave-btn');
             btn.textContent = `下一波 (${Math.ceil(game.autoNextWaveTimer)}s)`;
        }
    }

    // Entities
    game.enemies.forEach(e => e.update());
    // Filter dead enemies (handled inside update to allow "die" logic to run)
    game.enemies = game.enemies.filter(e => !e.dead);

    game.towers.forEach(t => t.update());
    // Filter destroyed towers
    game.towers = game.towers.filter(t => !t.dead);
    
    game.projectiles.forEach(p => p.update());
    game.projectiles = game.projectiles.filter(p => !p.dead);
    
    game.particles.forEach(p => p.update());
    game.particles = game.particles.filter(p => p.life > 0);

    // Food Logic
    // Random Spawn Chance (e.g., 1/300 chance per frame ~ once every 3-4s)
    if (game.waveActive && Math.random() < 0.003) {
        // Pick random segment
        const segIdx = Math.floor(Math.random() * (PATH_POINTS.length - 1));
        const p1 = PATH_POINTS[segIdx];
        const p2 = PATH_POINTS[segIdx+1];
        
        // Random t between 0 and 1
        const t = Math.random();
        const fx = (p1.x + (p2.x - p1.x) * t) * TILE_SIZE + TILE_SIZE/2;
        const fy = (p1.y + (p2.y - p1.y) * t) * TILE_SIZE + TILE_SIZE/2;
        
        game.foods.push(new Food(fx, fy));
    }

    game.foods.forEach(f => f.update());
    game.foods = game.foods.filter(f => f.life > 0);

    // Food Collision
    game.foods.forEach(f => {
        // Check collision with ANY enemy
        // Optimization: Find first enemy in range
        const eater = game.enemies.find(e => {
            const dist = Math.sqrt((e.x - f.x)**2 + (e.y - f.y)**2);
            return dist < 20; // Hitbox
        });
        
        if (eater) {
            f.life = 0; // Consumed
            if (f.type === 'heal') {
                eater.hp += eater.maxHp * 0.2; // Heal 20%
                if (eater.hp > eater.maxHp) eater.hp = eater.maxHp;
                game.particles.push(new TextParticle(eater.x, eater.y - 20, "+HP", '#ff0000'));
            } else if (f.type === 'speed') {
                eater.speed *= 1.3; // Speed up 30% (permanent for this unit)
                game.particles.push(new TextParticle(eater.x, eater.y - 20, "加速!", '#0000ff'));
            } else if (f.type === 'star') {
                eater.invincible = 300; // 5s @ 60fps (actually game runs at 90fps, so 450 frames for 5s)
                // Let's use 450 for 5 seconds at 90 FPS
                eater.invincible = 450;
                game.particles.push(new TextParticle(eater.x, eater.y - 20, "無敵!", '#FFD700'));
            } else if (f.type === 'poison') {
                // Poison Effect: Dmg + Slow
                // Damage 30% Max HP
                const dmg = Math.floor(eater.maxHp * 0.3);
                eater.hp -= dmg;
                game.particles.push(new TextParticle(eater.x, eater.y - 20, `-${dmg}`, '#C6FF00'));
                
                // Slow
                eater.frozen = 180; // 2 seconds slow
                game.particles.push(new TextParticle(eater.x, eater.y - 40, "中毒!", '#880088'));
                
                if (eater.hp <= 0) eater.die();
            }
        }
    });
}

function draw() {
    // Canvas Resizing Logic
    const wrapper = document.getElementById('canvas-wrapper');
    const targetWidth = wrapper.clientWidth;
    const targetHeight = wrapper.clientHeight;
    
    // Update internal size to match display size for crisp rendering
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
    }

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate Scale to fit the 800x600 logical game into the current canvas
    // We want to "contain" the game board
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw Background/Board Area
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Path
    ctx.strokeStyle = '#555';
    ctx.lineWidth = TILE_SIZE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(PATH_POINTS[0].x * TILE_SIZE + TILE_SIZE/2, PATH_POINTS[0].y * TILE_SIZE + TILE_SIZE/2);
    for(let i=1; i<PATH_POINTS.length; i++) {
        ctx.lineTo(PATH_POINTS[i].x * TILE_SIZE + TILE_SIZE/2, PATH_POINTS[i].y * TILE_SIZE + TILE_SIZE/2);
    }
    ctx.stroke();

    // Draw Grid (Optional, faint)
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    for(let i=0; i<=CANVAS_WIDTH; i+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i, CANVAS_HEIGHT); ctx.stroke();
    }
    for(let i=0; i<=CANVAS_HEIGHT; i+=TILE_SIZE) {
        ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(CANVAS_WIDTH, i); ctx.stroke();
    }

    // Entities
    game.towers.forEach(t => t.draw());
    game.enemies.forEach(e => e.draw());
    game.projectiles.forEach(p => p.draw());
    game.particles.forEach(p => p.draw());
    game.foods.forEach(f => f.draw());

    // Highlight Selected
    if (game.selectedTower) {
        const t = game.selectedTower;
        ctx.strokeStyle = '#ffca28';
        ctx.lineWidth = 2;
        ctx.strokeRect(t.gridX*TILE_SIZE, t.gridY*TILE_SIZE, TILE_SIZE, TILE_SIZE);
        
        // Range
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.baseRange, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.stroke();
    }
    
    // Ghost Tower (Build Mode)
    if (buildModeId !== null) {
         // Get mouse pos from global state if tracked, or we can just rely on the fact 
         // that we need to track mouse for this feature properly.
         // Let's use the game.mouseX/Y we declared earlier but haven't used yet.
         // Or simpler: use the last known mouse position from onCanvasMouseMove
         
         if (game.mouseX && game.mouseY) {
            const gx = Math.floor(game.mouseX / TILE_SIZE);
            const gy = Math.floor(game.mouseY / TILE_SIZE);
            
            if (gx >= 0 && gx < CANVAS_WIDTH/TILE_SIZE && gy >= 0 && gy < CANVAS_HEIGHT/TILE_SIZE) {
                const cx = gx * TILE_SIZE + TILE_SIZE/2;
                const cy = gy * TILE_SIZE + TILE_SIZE/2;
                const type = TOWER_TYPES[buildModeId];

                // Draw Ghost Range
                ctx.beginPath();
                ctx.arc(cx, cy, type.range, 0, Math.PI*2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.stroke();
                
                // Draw Ghost Tower (Semi-transparent)
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = type.color;
                ctx.beginPath();
                // Simple shape rep
                ctx.arc(cx, cy, 15, 0, Math.PI*2); 
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Color indication if valid
                const onPath = isPath(gx, gy);
                const isBarricade = buildModeId === 33;
                let validLocation = false;

                if (isBarricade) {
                    validLocation = onPath; // Barricade MUST be on path
                } else {
                    validLocation = !onPath; // Others MUST NOT be on path
                }

                // Also check for existing towers
                const existing = game.towers.find(t => t.gridX === gx && t.gridY === gy);
                const valid = validLocation && !existing;

                ctx.fillStyle = valid ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
         }
    }

    ctx.restore();
}

// --- Interaction ---

let buildModeId = null;

function showNotification(msg) {
    const overlay = document.getElementById('notification-overlay');
    const div = document.createElement('div');
    div.className = 'notification';
    div.textContent = msg;
    overlay.appendChild(div);
    setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
    }, 3000);
}

function selectTowerToBuild(id) {
    if (game.gold >= TOWER_TYPES[id].cost) {
        buildModeId = id;
        game.selectedTower = null;
        updateUI();
        document.body.style.cursor = 'crosshair';
        showNotification(`已選擇 ${TOWER_TYPES[id].name}。請點擊地圖建造。`);
    } else {
        showNotification("金錢不足!");
    }
}

function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    
    // Reverse Scale Calculation
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    const clickX = e.clientX - rect.left - offsetX;
    const clickY = e.clientY - rect.top - offsetY;

    const gameX = clickX / scale;
    const gameY = clickY / scale;

    // Check Enemy Click (Tap Damage)
    for (let i = game.enemies.length - 1; i >= 0; i--) {
        const e = game.enemies[i];
        // Hitbox approx 30px radius scaled
        const dist = Math.sqrt((e.x - gameX) ** 2 + (e.y - gameY) ** 2);
        if (dist < 30 * e.scale) { 
            const clickDmg = 10 + (game.wave * 5); // Base 10 + 5 per wave
            e.takeDamage(clickDmg, ELEMENTS.NONE);
            game.particles.push(new TextParticle(e.x, e.y - 40, "點擊!", '#ffffff'));
            return; // Handled click
        }
    }

    const x = Math.floor(gameX / TILE_SIZE);
    const y = Math.floor(gameY / TILE_SIZE);

    // Validate bounds
    if (x < 0 || x >= CANVAS_WIDTH/TILE_SIZE || y < 0 || y >= CANVAS_HEIGHT/TILE_SIZE) return;

    // Check existing tower
    const existing = game.towers.find(t => t.gridX === x && t.gridY === y);

    if (buildModeId !== null) {
        // Build Mode Logic
        const onPath = isPath(x, y);
        const isBarricade = buildModeId === 33;
        
        if (existing) {
             showNotification("該位置已被佔用!");
             return;
        }

        if (isBarricade) {
            if (!onPath) {
                 showNotification("路障必須建造在路徑上!");
                 return;
            }
        } else {
            if (onPath) {
                 showNotification("不能建造在路徑上!");
                 return;
            }
        }

        // Build
        const type = TOWER_TYPES[buildModeId];
        if (game.gold >= type.cost) {
            game.gold -= type.cost;
            game.towers.push(new Tower(buildModeId, x, y));
            buildModeId = null;
            document.body.style.cursor = 'default';
            updateUI();
            showNotification("防禦塔建造完成!");
        }
    } else {
        // Selection Logic
        if (existing) {
            game.selectedTower = existing;
            updateTowerInfo();
        } else {
            game.selectedTower = null;
            document.getElementById('selection-info').style.display = 'none';
        }
    }
}

function onCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / CANVAS_WIDTH;
    const scaleY = canvas.height / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);
    const offsetX = (canvas.width - CANVAS_WIDTH * scale) / 2;
    const offsetY = (canvas.height - CANVAS_HEIGHT * scale) / 2;

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    const gameX = mouseX / scale;
    const gameY = mouseY / scale;

    // Save for draw() loop
    game.mouseX = gameX;
    game.mouseY = gameY;

    if (buildModeId !== null) return; // Keep crosshair if building

    let hoveringEnemy = false;
    for (const e of game.enemies) {
        const dist = Math.sqrt((e.x - gameX) ** 2 + (e.y - gameY) ** 2);
        if (dist < 30 * e.scale) {
            hoveringEnemy = true;
            break;
        }
    }

    if (hoveringEnemy) {
        document.body.style.cursor = 'pointer';
    } else {
        document.body.style.cursor = 'default';
    }
}

function isPath(x, y) {
    // Simple segment check
    for(let i=0; i<PATH_POINTS.length-1; i++) {
        const p1 = PATH_POINTS[i];
        const p2 = PATH_POINTS[i+1];
        
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
    }
    return false;
}

// --- Random Events ---
const EVENTS = [
    { id: 0, name: "無事發生", desc: "風平浪靜的一天", weight: 40 },
    { id: 1, name: "怪物復甦", desc: "所有怪物血量瞬間回滿!", weight: 5, action: 'heal_enemies' },
    { id: 2, name: "血量倍增", desc: "本波怪物血量翻倍!", weight: 10, action: 'double_hp' },
    { id: 3, name: "急速行軍", desc: "本波怪物移動速度增加!", weight: 10, action: 'speed_up' },
    { id: 4, name: "建築腐蝕", desc: "所有防禦塔血量減半!", weight: 5, action: 'tower_decay' },
    { id: 5, name: "天降橫財", desc: "獲得大量金錢!", weight: 10, action: 'bonus_gold' },
    { id: 6, name: "虛空吞噬", desc: "一座隨機防禦塔消失了...", weight: 5, action: 'destroy_tower' },
    { id: 7, name: "元素突變", desc: "怪物屬性發生改變!", weight: 10, action: 'change_element' },
    { id: 8, name: "狂暴怒火", desc: "怪物攻擊力倍增!", weight: 5, action: 'double_dmg' }, // Note: Enemies attack towers
    { id: 9, name: "酸雨腐蝕", desc: "全場減速且塔持續扣血!", weight: 10, action: 'acid_rain' }
];

function triggerRandomEvent() {
    const roll = Math.random() * 110; // Increased weight sum
    let cum = 0;
    let event = EVENTS[0];
    
    // Normalize weights if needed, here just basic check
    // Total weight = 40+5+10+10+5+10+5+10+5+10 = 110
    for (const e of EVENTS) {
        cum += e.weight;
        if (roll < cum) {
            event = e;
            break;
        }
    }

    if (event.id === 0) return; // Nothing happens

    showNotification(`隨機事件: ${event.name} - ${event.desc}`);
    
    // Apply Effects
    switch (event.action) {
        case 'heal_enemies':
            game.enemies.forEach(e => e.hp = e.maxHp);
            break;
        case 'double_hp':
            // Apply to spawning config or active enemies? 
            // Better apply to current config for this wave spawning or active ones
            // Let's apply to config AND active
            const config = WAVES[game.wave - 1];
            if(config) config.hp *= 2; 
            game.enemies.forEach(e => { e.maxHp *= 2; e.hp *= 2; });
            break;
        case 'speed_up':
            const configS = WAVES[game.wave - 1];
            if(configS) configS.speed *= 1.5;
            game.enemies.forEach(e => e.speed *= 1.5);
            break;
        case 'tower_decay':
            game.towers.forEach(t => t.hp = Math.floor(t.hp / 2));
            break;
        case 'bonus_gold':
            game.gold += 500 + (game.wave * 100);
            updateUI();
            break;
        case 'destroy_tower':
            if (game.towers.length > 0) {
                const idx = Math.floor(Math.random() * game.towers.length);
                const t = game.towers[idx];
                t.dead = true;
                game.particles.push(new TextParticle(t.x, t.y, "消失!", '#888'));
            }
            break;
        case 'change_element':
            const newElemKey = ELEMENT_KEYS_ORIGINAL[Math.floor(Math.random() * 8)];
            const newElem = ELEMENTS[newElemKey];
            const configE = WAVES[game.wave - 1];
            if(configE) {
                configE.element = newElem;
                configE.elements = [newElem];
            }
            game.enemies.forEach(e => {
                e.element = newElem;
                e.elements = [newElem];
            });
            break;
        case 'double_dmg':
            // Logic handled in enemy attack, maybe add a flag to enemy or global multiplier
            // For simplicity, let's just use a global flag or modify enemy property if we had one
            // We hardcoded damage in Enemy.update(). Let's add a property to game or enemy
            // Simplest: Add damageMultiplier to game state for this wave
            game.enemyDamageMultiplier = 2.0; 
            break;
        case 'acid_rain':
            // Random duration 10-20 seconds (900-1800 frames)
            const durationSec = 10 + Math.random() * 10;
            game.acidRainTimer = Math.floor(durationSec * FPS);
            break;
    }
}

// --- Game Flow ---

function startNextWave() {
    if (game.waveActive || game.wave > 100) return;
    
    game.waveActive = true;
    game.autoNextWaveTimer = 0; // Clear timer
    
    // Reset Wave Specific Modifiers
    game.enemyDamageMultiplier = 1.0; 
    game.acidRainTimer = 0; // Clear weather on new wave start? Or let it persist? 
    // Usually weather clears. Let's reset it to be nice.

    // Trigger Event at start of wave
    if (game.wave > 1) triggerRandomEvent(); // Skip wave 1 for fairness

    const config = WAVES[game.wave - 1];
    game.enemiesToSpawn = config.count;
    game.spawnTimer = 0;
    
    const btn = document.getElementById('start-wave-btn');
    btn.disabled = true;
    btn.textContent = "波次進行中...";
    updateUI();
}

function endWave() {
    game.waveActive = false;
    game.wave++;
    
    // Wave Bonus
    const bonus = 100 + (game.wave * 25);
    game.gold += bonus;
    showNotification(`波次完成! 獲得 +$${bonus} 金幣。 塔樓已修復。`);
    
    // Heal/Buff Towers
    game.towers.forEach(t => {
        t.maxHp += 10;
        t.hp += 20;
        if(t.hp > t.maxHp) t.hp = t.maxHp;
    });

    if (game.wave > 100) {
        showNotification("勝利! 100關全破!");
        game.wave = 100; // Cap
    } else {
        // Start Auto Timer
        game.autoNextWaveTimer = 10; // 10 seconds
        document.getElementById('start-wave-btn').disabled = false;
    }
    updateUI();
}

function gameOver() {
    showNotification("遊戲結束 - 重新載入...");
    setTimeout(() => location.reload(), 3000);
}

function toggleSpeed() {
    game.speedFactor = game.speedFactor === 1 ? 2 : 1;
    const btn = document.getElementById('speed-btn');
    btn.textContent = game.speedFactor + 'x 速度';
    btn.className = game.speedFactor === 2 ? 'x2' : '';
}

function upgradeSelected() {
    const t = game.selectedTower;
    if (!t) return;
    const cost = t.getUpgradeCost();
    if (game.gold >= cost) {
        game.gold -= cost;
        t.level++;
        t.spent += cost;
        updateUI();
        updateTowerInfo();
    }
}

function sellSelected() {
    const t = game.selectedTower;
    if (!t) return;
    game.gold += t.getCost();
    game.towers = game.towers.filter(tower => tower !== t);
    game.selectedTower = null;
    document.getElementById('selection-info').style.display = 'none';
    updateUI();
}

// --- UI Updates ---

function startGame() {
    document.getElementById('splash-screen').style.display = 'none';
    game.isGameStarted = true;
    game.autoNextWaveTimer = 10; // Start Countdown for Wave 1
    updateUI();
}

function updateUI() {
    document.getElementById('gold-display').textContent = game.gold;
    document.getElementById('lives-display').textContent = game.lives;
    document.getElementById('wave-display').textContent = `${game.wave} / 100`;
    document.getElementById('score-display').textContent = game.score;

    // Next Wave Info
    if (game.wave <= 100) {
        const next = WAVES[game.wave - 1];
        let elemHtml = '';
        if (next.elements && next.elements.length > 0) {
            elemHtml = next.elements.map(e => `<span style="color:${ELEMENT_COLORS[e]}">${e}</span>`).join(' + ');
        } else {
            elemHtml = `<span style="color:${ELEMENT_COLORS[next.element]}">${next.element}</span>`;
        }
        
        document.getElementById('next-wave-details').innerHTML = `
            屬性: ${elemHtml}<br>
            數量: ${next.count}<br>
            血量: ${next.hp}
        `;
    } else {
        document.getElementById('next-wave-details').textContent = "全數通關!";
    }
}

function updateTowerInfo() {
    const t = game.selectedTower;
    if (!t) return;
    
    const info = document.getElementById('selection-info');
    info.style.display = 'block';
    
    document.getElementById('sel-name').textContent = TOWER_TYPES[t.typeId].name;
    document.getElementById('sel-type').textContent = t.element;
    document.getElementById('sel-hp').textContent = `${Math.floor(t.hp)}/${t.maxHp}`;
    document.getElementById('sel-dmg').textContent = t.getDamage();
    document.getElementById('sel-speed').textContent = t.baseCooldown;
    document.getElementById('sel-range').textContent = t.baseRange / TILE_SIZE;
    document.getElementById('sel-level').textContent = t.level;
    
    // Skill info
    const skillRow = document.getElementById('skill-row');
    const skillSpan = document.getElementById('sel-skill');
    const skillBtn = document.getElementById('cast-skill-btn');
    
    const type = TOWER_TYPES[t.typeId];
    if (type.skill) {
        skillRow.style.display = 'flex';
        skillSpan.textContent = type.skillDesc;
        
        if (type.skill === 'nuke') {
            skillBtn.style.display = 'block';
            if (t.activeSkillCd > 0) {
                skillBtn.disabled = true;
                skillBtn.textContent = `冷卻中 (${Math.ceil(t.activeSkillCd/60)}s)`;
                skillBtn.style.background = '#555';
            } else {
                skillBtn.disabled = false;
                skillBtn.textContent = "主動: 核彈 (就緒)";
                skillBtn.style.background = '#7b1fa2';
                skillBtn.onclick = () => {
                    if (t.triggerActiveSkill()) {
                        // Success
                    }
                };
            }
        } else {
            skillBtn.style.display = 'none';
        }
    } else {
        skillRow.style.display = 'none';
        skillBtn.style.display = 'none';
    }
    
    document.getElementById('upg-cost').textContent = t.getUpgradeCost();
    document.getElementById('sell-cost').textContent = t.getCost();
}

// --- Tooltip Logic ---
function showTooltip(type, e) {
    const tt = document.getElementById('tooltip');
    tt.style.display = 'block';
    
    // Skill Description logic
    let skillText = "無";
    if (type.skill) {
        skillText = type.skillDesc;
    }
    
    // Format Speed (Lower is faster)
    let speedText = type.cooldown;
    if (type.cooldown <= 10) speedText += " (極快)";
    else if (type.cooldown <= 30) speedText += " (快)";
    else if (type.cooldown <= 60) speedText += " (中)";
    else if (type.cooldown <= 90) speedText += " (慢)";
    else speedText += " (極慢)";

    tt.innerHTML = `
        <strong>${type.name}</strong>
        <div class="tt-prop"><span>傷害:</span> <span class="tt-val">${type.damage}</span></div>
        <div class="tt-prop"><span>攻速:</span> <span class="tt-val">${speedText}</span></div>
        <div class="tt-prop"><span>範圍:</span> <span class="tt-val">${type.range/TILE_SIZE}</span></div>
        <div class="tt-prop"><span>屬性:</span> <span class="tt-val" style="color:${type.color}">${type.element}</span></div>
        <div class="tt-desc">${skillText}</div>
    `;
    
    moveTooltip(e);
}

function moveTooltip(e) {
    const tt = document.getElementById('tooltip');
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    
    // Boundary check to prevent overflow
    if (y + tt.offsetHeight > window.innerHeight) {
        tt.style.top = (e.clientY - tt.offsetHeight - 10) + 'px';
    } else {
        tt.style.top = y + 'px';
    }
    
    if (x + tt.offsetWidth > window.innerWidth) {
        tt.style.left = (e.clientX - tt.offsetWidth - 10) + 'px';
    } else {
        tt.style.left = x + 'px';
    }
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// Boot
window.onload = init;
