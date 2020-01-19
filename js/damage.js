const btnElement = document.getElementById("calculate-btn");
const hitElement = document.getElementById("hit-roll");
const damageElement = document.getElementById("damage-mod");
const semiElement = document.getElementById("semi-auto");
const fullElement = document.getElementById("full-auto");
const truncElement = document.getElementById("truncate");
const tagsElement = document.getElementById("trait-tags");

// Damage dice
const DIE = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
const DIE_HAMMER = [0.02, 0.02, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12];
const DIE_TEARING = [0.01, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19];
//====================================================================================================================================== Not sure if correct
const DIE_HAMMER_TEARING = [0.0004, 0.0012, 0.052, 0.0728, 0.0936, 0.1144, 0.1352, 0.156, 0.1768, 0.1976];

var traits = {
    reliable: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`reliable\`); return false;">Reliable <span>&times;</span></button>`,
        clash: [`unreliable`]
    },
    unreliable: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`unreliable\`); return false;">Unreliable <span>&times;</span></button>`,
        clash: [`reliable`]
    },
    tearing: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`tearing\`); return false;">Tearing <span>&times;</span></button>`,
        clash: []
    },
    hammer: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`hammer\`); return false;">Hammer of the Emperor <span>&times;</span></button>`,
        clash: []
    },
    rds: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`rds\`); return false;">Red Dot Sight <span>&times;</span></button>`,
        clash: []
    },
    mp: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`mp\`); return false;">Motion Predictor <span>&times;</span></button>`,
        clash: []
    },
    storm: {
        state: false,
        string: `<button class="btn tag" onclick="remove_trait(\`storm\`); return false;">Storm <span>&times;</span></button>`,
        clash: []
    }
}

// Get die result probability
function die(i, tearing, hammer) {
    if (hammer) {
        if (tearing) {
            return DIE_HAMMER_TEARING[i];
        } else {
            return DIE_HAMMER[i];
        }
    } else if (tearing) {
        return DIE_TEARING[i];
    } else {
        return DIE[i];
    }
}

// Simple distribution over integers from 0 to size-1
class distribution {
    constructor(size) {
        this.size = size;
        this.density = Array(size).fill(0);
    }

    // Find distribution of sum of independent random variables
    convolve(other) {
        let new_size = this.size + other.size - 1;
        let result = new distribution(new_size);
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < other.size; j++) {
                result.density[i + j] += this.density[i] * other.density[j];
            }
        }
        return result;
    }

    // Add in place (up to min of sizes), possible shifted and scaled
    // Return any unused weight
    plus_equals(other, shift=0, scale=1) {
        let delta = Math.max(0, shift);
        let min_size = Math.min(this.size - delta, other.size);
        for (let i = 0; i < min_size; i++) {
            this.density[i + delta] += scale * other.density[i];
        }
        let sum = 0;
        for (let i = min_size; i < other.size; i++) {
            sum += scale * other.density[i]
        }
        return sum;
    }

    // Output cumulative distribution (possibly truncated)
    cumulative() {
        let sum = 1;
        let result = new distribution(this.size);
        for (let i = 0; i < this.size; i++) {
            result.density[i] = Math.max(sum, 0);
            sum -= this.density[i];
        }
        return result;
    }

    // For debugging
    log() {
        let sum = 0;
        let text = "";
        for (let j = 0; j < this.size; j++) {
            sum += this.density[j];
            text += this.density[j] + ", ";
        }
        console.log("Size: " + this.size);
        console.log("FlatDist: " + text);
        console.log("Sum: " + sum);
    }
}

// Distribution over min roll and damage sum
class damageDist {
    constructor(size) {
        this.size = size;
        this.density = Array.from(Array(10), () => new distribution(size));
    }
    
    // Find distribution of sum of damage rolls
    sum(otherDist) {
        let newSize = this.size + otherDist.size;
        let result = new damageDist(newSize);
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                result.density[Math.min(i, j)].plus_equals(this.density[i].convolve(otherDist.density[j]));
            }
        }
        return result;
    }

    // Combine different min dice values into simple distribution, replacing with DoS when it makes sense
    collapse(DoS, modifier) {
        let threshold = Math.min(10, DoS);
        let result = new distribution(this.size);
        for (let i = threshold; i < 10; i++) {
            result.plus_equals(this.density[i]);
        }
        for (let i = 0; i < threshold; i++) {
            let shift = Math.max(DoS + modifier, 0) - Math.max(i + modifier + 1, 0);
            result.plus_equals(this.density[i], shift);
        }
        return result;
    }

    // For debugging
    log() {
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            let text = "";
            for (let j = 0; j < this.size; j++) {
                sum += this.density[i].density[j];
                text += this.density[i].density[j] + ", ";
            }
            console.log("Min(" + (i+1) + "): " + text);
        }
        console.log("Sum: " + sum);
    }
}

// Build a damage distribution for single shot of given profile
function getBaseDamage(modifier, tearing, hammer) {
    let size = Math.max(1, modifier + 11);
    let result = new damageDist(size);
    for (let i = 0; i < 10; i++) {
        result.density[i].density[Math.max(0, modifier + i + 1)] = die(i, tearing, hammer);
    }
    return result;
}

// Create array of probabilities of each number of DoS
//======================================================================================================================= Possible issues when we have many degrees of success.
function getDoSChances(hit_chance, reliability) {
    let chance = hit_chance;
    let result = [1 - Math.min(chance, reliability)/100];
    while (chance > reliability + 10) {
        result.push(0);
        chance -= 10;
    }
    if (chance > reliability) {
        result.push((reliability + 10 - chance) / 100);
        chance = reliability;
    }
    while (chance > 10) {
        result.push(0.1);
        chance -= 10;
    }
    if (chance > 1) {
        result.push((chance - 1)/100);
    }
    result.push(0.01);
    return result;
}

// Create array of damage distributions for each number of hits
function getMultiDamage(base_damage, max_hits) {
    let result = [base_damage];
    let current = base_damage;
    for (let i = 1; i < max_hits; i++) {
        current = current.sum(base_damage);
        result.push(current);
    }
    return result;
}

// Create overall cumulative damage distribution
function getOverallDamage(multi_damage, DoS_dist, shot_function, damage_modifier, truncate) {
    let result = new distribution(truncate);
    let sum = 0;
    for (let i = 1; i < DoS_dist.length; i++) {
        sum += result.plus_equals(multi_damage[shot_function(i)-1].collapse(i, damage_modifier), 0, DoS_dist[i]);
    }
    result.density[truncate - 1] += sum;
    sum = 0;
    for (let i = 0; i < truncate; i++) {
        sum += result.density[i];
    }
    result.density[0] += (1.0 - sum);
    return result.cumulative().density;
}

// Generate attack damage distributions for each shot type
function attack_damage(hit_chance, damageModifier, semi_auto_RoF, full_auto_RoF, truncate, tearing, hammer, rds, mp, storm, single_reliability, auto_reliability) {

    // Find damage distributions for different numbers of hits
    let base = getBaseDamage(damageModifier, tearing, hammer);
    let max_hits = Math.max(1, semi_auto_RoF, full_auto_RoF);
    let storm_bonus = storm ? 2 : 1;
    let multi_damage = getMultiDamage(base, storm_bonus * max_hits);

    // Find DoS distributions
    let single_DoS = getDoSChances(rds ? hit_chance + 20 : hit_chance + 10, single_reliability);
    let semi_DoS = getDoSChances(mp ? hit_chance + 10 : hit_chance, auto_reliability);
    let full_DoS = getDoSChances(mp ? hit_chance : hit_chance - 10, auto_reliability);

    // Find overall damage distributions
    let single_damage = getOverallDamage(multi_damage, single_DoS, (i) => storm_bonus, damageModifier, truncate);
    let semi_damage = null;
    let full_damage = null;
    if (semi_auto_RoF > 0) {
        semi_damage = getOverallDamage(multi_damage, semi_DoS, (i) => storm_bonus * Math.min((i + 1) >> 1, semi_auto_RoF), damageModifier, truncate);
    }
    if (full_auto_RoF > 0) {
        full_damage = getOverallDamage(multi_damage, full_DoS, (i) => storm_bonus * Math.min(i, full_auto_RoF), damageModifier, truncate);
    }

    // Construct plot data
    let data = [{
        x: Array.from({length: truncate}, (x,i) => i),
        y: single_damage,
        //mode: "markers",
        type: "scatter",
        name: "Standard Attack"
    }];
    if (semi_damage !== null) {
        data.push({
            x: Array.from({length: truncate}, (x,i) => i),
            y: semi_damage,
            //mode: "markers",
            type: "scatter",
            name: "Semi-Auto Burst"
        });
    }
    if (full_damage !== null) {
        data.push({
            x: Array.from({length: truncate}, (x,i) => i),
            y: full_damage,
            //mode: "markers",
            type: "scatter",
            name: "Full-Auto Burst"
        });
    }
    return data;
}

// Draw tags for each active trait
function draw_traits() {
    let text = "";
    for (key in traits){
        if (traits[key].state) {
            text += traits[key].string;
        }
    }
    tagsElement.innerHTML = text;
}

// Add a trait for the calculation, ensuring no clashes
function add_trait(trait) {
    if (traits[trait] !== undefined) {
        if(traits[trait].state == false) {
            traits[trait].state = true;
            let clash = traits[trait].clash;
            if (clash !== undefined) {
                for (let i = 0; i < clash.length; i++) {
                    traits[clash[i]].state = false;
                }
            }
            draw_traits();
        }
    }
}

// Remove a trait for the calculation
function remove_trait(trait) {
    if (traits[trait] !== undefined) {
        if(traits[trait].state == true) {
            traits[trait].state = false;
            draw_traits();
        }
    }
}

// Update the damage chart
function update_plot() {
    btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
    btnElement.disabled = true;

    let hit_roll = parseInt(hitElement.value);
    let damage_modifier = parseInt(damageElement.value);
    let semi_auto_RoF = parseInt(semiElement.value);
    let full_auto_RoF = parseInt(fullElement.value);
    let truncate = Math.max(parseInt(truncElement.value) + 1, 1);
    let single_reliability = traits.reliable.state ? 99 : (traits.unreliable.state ? 90 : 95);
    let auto_reliability = traits.reliable.state ? 99 : (traits.unreliable.state ? 90 : 93);
    
    let data = attack_damage(hit_roll, damage_modifier, semi_auto_RoF, full_auto_RoF, truncate, traits.tearing.state, traits.hammer.state, traits.rds.state, traits.mp.state, traits.storm.state, single_reliability, auto_reliability);
    let layout = {
        title: {
            text: "Probability of Doing at Least X Damage"
        },
        xaxis: {
          dtick: 1,
          title: {
              text: "X Damage"
          },
          range: [0, truncate - 0.9]
        },
        yaxis: {
            title: {
                text: "Probability"
            },
            range: [0, 1.05]
        },
        legend: {
            x: 1,
            xanchor: 'right',
            y: 1
        }
    };
    Plotly.newPlot("chart", data, layout);

    btnElement.innerHTML = "Calculate";
    btnElement.disabled = false;
}

// Initial run
update_plot()