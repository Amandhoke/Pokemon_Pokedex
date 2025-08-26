// --- CACHING FOR TYPE DATA ---
const typeCache = new Map();

// --- GLOBAL VARIABLES ---
let allPokemon = [];
let displayedPokemon = [];
let currentPage = 1;
let currentFilter = 'all';
let favorites = JSON.parse(localStorage.getItem('pokemonFavorites')) || [];
let searchTimeout;

// --- CONSTANTS ---
const MAX_POKEMON = 151;
const POKEMON_PER_PAGE = 20;
const API_BASE_URL = 'https://pokeapi.co/api/v2';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    loadPokemon();
    setupModal();
    setupSearch();
});

// --- DATA LOADING ---
async function loadPokemon() {
    try {
        showLoading(true);
        await loadPokemonBatch(1, POKEMON_PER_PAGE);
        showLoading(false);
        displayPokemon();
        loadRemainingPokemon();
    } catch (error) {
        console.error('Error loading Pokemon:', error);
        showLoading(false);
    }
}

async function loadPokemonBatch(start, count) {
    const promises = [];
    for (let i = start; i < start + count && i <= MAX_POKEMON; i++) {
        promises.push(fetchPokemonData(i));
    }
    const results = await Promise.all(promises);
    allPokemon.push(...results.filter(p => p !== null));
    displayedPokemon = [...allPokemon];
}

async function loadRemainingPokemon() {
    for (let start = POKEMON_PER_PAGE + 1; start <= MAX_POKEMON; start += 10) {
        await loadPokemonBatch(start, 10);
        if (document.getElementById('searchInput').value.trim() === '') {
            displayPokemon();
        }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

async function fetchPokemonData(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/pokemon/${id}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return {
            id: data.id,
            name: data.name,
            types: data.types.map(t => t.type.name),
            image: {
                default: data.sprites.other?.['official-artwork']?.front_default || data.sprites.front_default,
                shiny: data.sprites.other?.['official-artwork']?.front_shiny || data.sprites.front_shiny
            },
            cry: data.cries?.latest,
            stats: data.stats.map(s => ({ name: s.stat.name, value: s.base_stat })),
            height: data.height || 0,
            weight: data.weight || 0,
            abilities: data.abilities?.map(a => a.ability.name) || []
        };
    } catch (error) {
        console.error(`Error fetching Pokemon ${id}:`, error);
        return null;
    }
}

// --- UI RENDERING ---
function displayPokemon() {
    const grid = document.getElementById('pokemonGrid');
    const startIndex = (currentPage - 1) * POKEMON_PER_PAGE;
    const pokemonToShow = displayedPokemon.slice(startIndex, startIndex + POKEMON_PER_PAGE);

    if (pokemonToShow.length === 0 && allPokemon.length > 0) {
        grid.innerHTML = `<p style="color: white; text-align: center; grid-column: 1 / -1; font-size: 1.2rem;">No Pokémon found.</p>`;
    } else {
        grid.innerHTML = pokemonToShow.map(createPokemonCard).join('');
    }
    updatePagination();
}

function createPokemonCard(pokemon) {
    const isFavorite = favorites.includes(pokemon.id);
    return `
        <div class="pokemon-card" onclick="showPokemonDetails(${pokemon.id})">
            <div class="pokemon-id">#${pokemon.id.toString().padStart(3, '0')}</div>
            <div class="pokemon-image"><img src="${pokemon.image.default}" alt="${pokemon.name}" loading="lazy"></div>
            <h3 class="pokemon-name">${pokemon.name}</h3>
            <div class="pokemon-types">${pokemon.types.map(type => `<span class="type-badge type-${type}">${type}</span>`).join('')}</div>
            <div class="pokemon-stats">
                <div class="stat-row"><span>Height:</span><span>${(pokemon.height / 10).toFixed(1)} m</span></div>
                <div class="stat-row"><span>Weight:</span><span>${(pokemon.weight / 10).toFixed(1)} kg</span></div>
                <div class="stat-row"><span>Base HP:</span><span>${pokemon.stats.find(s => s.name === 'hp')?.value || 'N/A'}</span></div>
            </div>
            <button class="favorite-btn" onclick="event.stopPropagation(); toggleFavorite(${pokemon.id})" style="position: absolute; top: 10px; left: 15px; background: none; border: none; font-size: 1.5rem; cursor: pointer;" aria-label="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">${isFavorite ? '❤️' : '🤍'}</button>
        </div>
    `;
}

// --- MODAL LOGIC ---
async function showPokemonDetails(id) {
    const pokemon = allPokemon.find(p => p.id === id);
    if (!pokemon) return;

    const modal = document.getElementById('pokemonModal');
    const modalContentContainer = document.querySelector('.modal-content');
    const modalContent = document.getElementById('modalContent');
    
    modalContentContainer.scrollTop = 0;

    modalContent.innerHTML = `<div class="spinner"></div><p style="text-align:center;">Loading details...</p>`;
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';

    const cryButton = pokemon.cry ? `<button onclick="new Audio('${pokemon.cry}').play()" style="background:none; border:none; font-size:1.5rem; cursor:pointer;" aria-label="Play Pokémon cry">🔊</button>` : '';
    const shinyButton = pokemon.image.shiny ? `<button onclick="toggleShiny('${pokemon.image.default}', '${pokemon.image.shiny}')" style="background:rgba(0,0,0,0.1); border:none; font-size:1rem; cursor:pointer; padding: 5px 10px; border-radius: 20px; margin-left: 10px;" aria-label="Toggle shiny version">✨</button>` : '';

    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                <h2 style="color: #333; text-transform: capitalize;">${pokemon.name}</h2>
                ${cryButton}
            </div>
            <div style="position: relative; display: inline-block;">
                <img id="pokemonDetailImage" src="${pokemon.image.default}" alt="${pokemon.name}" style="width: 200px; height: 200px; object-fit: contain; transition: transform 0.3s;">
                <div style="position: absolute; top: -10px; right: -10px; background: linear-gradient(45deg, #667eea, #764ba2); color: white; padding: 0.5rem; border-radius: 50%; font-weight: bold;">#${pokemon.id}</div>
            </div>
            <div>${shinyButton}</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
             <div>
                <h3 style="color: #333; margin-bottom: 1rem;">Basic Info</h3>
                <div style="background: rgba(102, 126, 234, 0.1); padding: 1rem; border-radius: 10px;">
                    <p><strong>Height:</strong> ${(pokemon.height / 10).toFixed(1)} m</p>
                    <p><strong>Weight:</strong> ${(pokemon.weight / 10).toFixed(1)} kg</p>
                    <p><strong>Abilities:</strong><br><i style="text-transform:capitalize;">${pokemon.abilities.join(', ')}</i></p>
                </div>
            </div>
            <div>
                <h3 style="color: #333; margin-bottom: 1rem;">Base Stats</h3>
                <div style="background: rgba(102, 126, 234, 0.1); padding: 1rem; border-radius: 10px;">
                    ${pokemon.stats.map(stat => `
                        <div style="margin: 0.5rem 0;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.2rem; font-size: 0.9rem;">
                                <span style="text-transform: capitalize; font-weight: bold;">${stat.name.replace('-', ' ')}</span>
                                <span>${stat.value}</span>
                            </div>
                            <div style="background: #ddd; height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="background: linear-gradient(45deg, #667eea, #764ba2); height: 100%; width: ${Math.min(100, (stat.value / 150) * 100)}%;"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </div>
        </div>
        <div id="typeEffectivenessContainer" style="margin-bottom: 2rem;">
            <h3 style="color: #333; margin-bottom: 1rem; text-align: center;">Type Matchups</h3>
            <div id="typeEffectivenessContent" style="text-align: center; background: rgba(102, 126, 234, 0.1); padding: 1rem; border-radius: 10px;">Loading matchups...</div>
        </div>
        <div id="evolutionContainer">
            <h3 style="color: #333; margin-bottom: 1rem; text-align: center;">Evolution Chain</h3>
            <div id="evolutionContent" style="display: flex; justify-content: center; align-items: center; flex-wrap: wrap; text-align: center; background: rgba(102, 126, 234, 0.1); padding: 1rem; border-radius: 10px;">Loading evolution...</div>
        </div>
    `;
    
    renderEvolutionChain(pokemon.id);
    renderTypeEffectiveness(pokemon.types);
}

async function renderEvolutionChain(id) {
    const evolutionContent = document.getElementById('evolutionContent');
    try {
        const speciesResponse = await fetch(`${API_BASE_URL}/pokemon-species/${id}`);
        if (!speciesResponse.ok) throw new Error('Species not found');
        const speciesData = await speciesResponse.json();
        
        const evolutionResponse = await fetch(speciesData.evolution_chain.url);
        if (!evolutionResponse.ok) throw new Error('Evolution chain not found');
        const evolutionData = await evolutionResponse.json();
        
        let chain = [];
        let current = evolutionData.chain;
        while (current) {
            chain.push(current.species.name);
            current = current.evolves_to[0];
        }

        if (chain.length > 1) {
            const evolutionHTML = chain.map(name => {
                const p = allPokemon.find(p => p.name === name);
                if (!p) return '';
                return `<div style="text-align: center; margin: 0 0.5rem; cursor: pointer;" onclick="showPokemonDetails(${p.id})">
                            <img src="${p.image.default}" alt="${p.name}" style="width: 80px; height: 80px; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <p style="text-transform: capitalize;">${p.name}</p>
                        </div>`;
            }).join('<span style="font-size: 2rem; margin: auto 0.5rem; opacity: 0.5;">→</span>');
            evolutionContent.innerHTML = evolutionHTML;
        } else {
            evolutionContent.innerHTML = `<p style="text-transform: capitalize;">${allPokemon.find(p=>p.id===id).name} does not evolve.</p>`;
        }
    } catch (error) {
        evolutionContent.innerHTML = 'Could not load evolution data.';
    }
}

async function renderTypeEffectiveness(types) {
    const effectivenessContent = document.getElementById('typeEffectivenessContent');
    const effectiveness = await calculateTypeEffectiveness(types);

    const weaknessesHTML = effectiveness.weaknesses.length ? `<div><strong>Weak Against (2x/4x):</strong><br>${effectiveness.weaknesses.map(t => `<span class="type-badge type-${t}">${t}</span>`).join(' ')}</div>` : '';
    const resistancesHTML = effectiveness.resistances.length ? `<div style="margin-top:10px;"><strong>Resistant To (0.5x/0.25x):</strong><br>${effectiveness.resistances.map(t => `<span class="type-badge type-${t}">${t}</span>`).join(' ')}</div>` : '';
    const immunitiesHTML = effectiveness.immunities.length ? `<div style="margin-top:10px;"><strong>Immune To (0x):</strong><br>${effectiveness.immunities.map(t => `<span class="type-badge type-${t}">${t}</span>`).join(' ')}</div>` : '';
    
    const finalHTML = [weaknessesHTML, resistancesHTML, immunitiesHTML].filter(Boolean).join('');
    effectivenessContent.innerHTML = finalHTML || 'This Pokémon has no special type matchups.';
}

async function calculateTypeEffectiveness(types) {
    const allRelations = await Promise.all(types.map(async type => {
        if (typeCache.has(type)) return typeCache.get(type);
        const res = await fetch(`${API_BASE_URL}/type/${type}`);
        const data = await res.json();
        typeCache.set(type, data.damage_relations);
        return data.damage_relations;
    }));

    const effectiveness = {};
    const allTypes = ["normal", "fire", "water", "grass", "electric", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];

    allTypes.forEach(type => {
        let multiplier = 1;
        allRelations.forEach(relation => {
            if (relation.double_damage_from.some(t => t.name === type)) multiplier *= 2;
            if (relation.half_damage_from.some(t => t.name === type)) multiplier *= 0.5;
            if (relation.no_damage_from.some(t => t.name === type)) multiplier *= 0;
        });
        if(multiplier !== 1) effectiveness[type] = multiplier;
    });
    
    return {
        weaknesses: Object.keys(effectiveness).filter(t => effectiveness[t] >= 2),
        resistances: Object.keys(effectiveness).filter(t => effectiveness[t] > 0 && effectiveness[t] < 1),
        immunities: Object.keys(effectiveness).filter(t => effectiveness[t] === 0)
    };
}

function toggleShiny(defaultUrl, shinyUrl) {
    const img = document.getElementById('pokemonDetailImage');
    img.style.transform = 'scale(0.8)';
    setTimeout(() => {
        img.src = img.src === defaultUrl ? shinyUrl : defaultUrl;
        img.style.transform = 'scale(1)';
    }, 150);
}

// --- SEARCH & FILTER ---
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchPokemon, 300);
    });
}

function searchPokemon() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-btn').classList.add('active');
    
    displayedPokemon = allPokemon.filter(p => p.name.toLowerCase().includes(query) || p.id.toString().includes(query));
    currentPage = 1;
    displayPokemon();
}

function filterByType(type) {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    displayedPokemon = (type === 'all') ? [...allPokemon] : allPokemon.filter(p => p.types.includes(type));
    currentPage = 1;
    displayPokemon();
}

// --- PAGINATION ---
function nextPage() {
    if (currentPage * POKEMON_PER_PAGE < displayedPokemon.length) {
        currentPage++;
        displayPokemon();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        displayPokemon();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updatePagination() {
    const totalPages = Math.ceil(displayedPokemon.length / POKEMON_PER_PAGE) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

// --- FAVORITES & STATS ---
function toggleFavorite(id) {
    const index = favorites.indexOf(id);
    if (index === -1) favorites.push(id);
    else favorites.splice(index, 1);
    localStorage.setItem('pokemonFavorites', JSON.stringify(favorites));
    displayPokemon();
}

function showFavorites() {
    if (favorites.length === 0) {
        alert('No favorite Pokémon yet!');
        return;
    }
    document.getElementById('searchInput').value = '';
    displayedPokemon = allPokemon.filter(p => favorites.includes(p.id));
    currentPage = 1;
    displayPokemon();
}

function showAllPokemon() {
    document.getElementById('searchInput').value = '';
    displayedPokemon = [...allPokemon];
    currentPage = 1;
    displayPokemon();
}

function showStats() {
    const totalPokemon = allPokemon.length;
    const favoriteCount = favorites.length;
    const typeStats = {};
    allPokemon.forEach(pokemon => {
        pokemon.types.forEach(type => {
            typeStats[type] = (typeStats[type] || 0) + 1;
        });
    });
    const sortedTypes = Object.entries(typeStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    alert(`📊 Pokédex Statistics:\n\n` +
          `Total Pokémon: ${totalPokemon}\n` +
          `Favorites: ${favoriteCount}\n\n` +
          `Top 5 Types:\n` +
          sortedTypes.map(([type, count]) => `${type}: ${count} Pokémon`).join('\n'));
}

// --- UTILITIES ---
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
    document.getElementById('pokemonGrid').style.display = show ? 'none' : 'grid';
    document.getElementById('pagination').style.display = show ? 'none' : 'flex';
}

function setupModal() {
    const modal = document.getElementById('pokemonModal');
    function closeModal() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    document.querySelector('.close').onclick = closeModal;
    window.onclick = (event) => { if (event.target === modal) closeModal(); };
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
}