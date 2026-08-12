import { useState } from 'react';
import { Database, Result } from '../types';
import { GENDERS, AGES, AGE_ICONS, GENDER_ICONS } from '../db';
import { Search, Trophy, Sparkles, X } from 'lucide-react';
import { fireCelebrationConfetti, fireGoldWinnerBurst } from '../utils/confetti';

interface ResultsProps {
  db: Database;
}

export default function Results({ db }: ResultsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Boys' | 'Girls' | 'General'>('All');
  const [selectedAge, setSelectedAge] = useState<'All' | 'Kids' | 'Sub Junior' | 'Junior' | 'Senior' | 'Super Senior'>('All');

  const [selectedTeam, setSelectedTeam] = useState<string>('All');

  const getCandidateClassInfo = (name: string, teamId: string | null) => {
    const p = db.participants.find(x => x.name === name && x.teamId === teamId);
    if (!p || !p.cls) return '';
    return p.cls + (p.division ? ' ' + p.division : '');
  };

  // Filter logic
  const filteredResults = [...db.results]
    .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
    .filter(r => {
      // Gender filter
      if (selectedGender !== 'All' && r.gender !== selectedGender) return false;

      // Age filter
      if (selectedAge !== 'All' && r.age !== selectedAge) return false;

      // Selected Team filter
      if (selectedTeam !== 'All') {
        const checkTeamEntries = (arr: any[]) =>
          arr.some(e => e.teamId === selectedTeam);
        const matchesWinnersTeam =
          checkTeamEntries(r.winners.first) ||
          checkTeamEntries(r.winners.second) ||
          checkTeamEntries(r.winners.third);
        const matchesGradesTeam =
          checkTeamEntries(r.grades.gradeA) ||
          checkTeamEntries(r.grades.gradeB) ||
          checkTeamEntries(r.grades.gradeC) ||
          checkTeamEntries(r.grades.participation);
        if (!matchesWinnersTeam && !matchesGradesTeam) return false;
      }

      // Search term match
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const prog = db.programs.find(p => p.id === r.programId);
        
        const matchesProgram = prog && (
          prog.name.toLowerCase().includes(term) || 
          prog.code.toLowerCase().includes(term)
        );

        const checkEntries = (arr: any[]) => 
          arr.some(e => {
            if (e.name && e.name.toLowerCase().includes(term)) return true;
            if (e.teamId) {
              if (e.teamId.toLowerCase().includes(term)) return true;
              const team = db.teams.find(t => t.id === e.teamId);
              if (team && team.name.toLowerCase().includes(term)) return true;
            }
            return false;
          });

        const matchesWinners = 
          checkEntries(r.winners.first) || 
          checkEntries(r.winners.second) || 
          checkEntries(r.winners.third);

        const matchesGrades = 
          checkEntries(r.grades.gradeA) || 
          checkEntries(r.grades.gradeB) || 
          checkEntries(r.grades.gradeC) || 
          checkEntries(r.grades.participation);

        if (!matchesProgram && !matchesWinners && !matchesGrades) return false;
      }

      return true;
    });

  return (
    <div className="view active pb-20 max-w-2xl mx-auto space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-brand-gold-500" />
        <h2 className="font-display font-bold text-brand-green-900 text-sm md:text-base">
          Competition Winners & Results
        </h2>
      </div>

      {/* Searchbar */}
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search team name, program code, candidate..."
          className="w-full pl-11 pr-10 py-3 bg-brand-panel border border-brand-line rounded-2xl text-xs md:text-sm text-brand-ink placeholder:text-brand-ink-soft/60 focus:outline-none focus:border-brand-gold-500 transition-colors shadow-sm"
        />
        <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-brand-ink-soft/50" />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3.5 top-3.5 text-brand-ink-soft/60 hover:text-brand-ink p-0.5 rounded-full"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Chips - Teams */}
      {db.teams && db.teams.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
            Filter By Team
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
            <button
              onClick={() => setSelectedTeam('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                selectedTeam === 'All'
                  ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                  : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
              }`}
            >
              All Teams
            </button>
            {db.teams.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedTeam === t.id
                    ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                    : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                }`}
              >
                <span>{t.symbol || '🛡️'}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Chips - Gender */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
          Sections
        </label>
        <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
          {['All', ...GENDERS].map(g => (
            <button
              key={g}
              onClick={() => setSelectedGender(g as any)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                selectedGender === g
                  ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                  : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Chips - Age */}
      {selectedGender !== 'General' && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-brand-gold-700 tracking-wider uppercase px-1">
            Age Divisions
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 select-none scrollbar-none">
            {['All', ...AGES].map(a => (
              <button
                key={a}
                onClick={() => setSelectedAge(a as any)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap border cursor-pointer transition-all ${
                  selectedAge === a
                    ? 'bg-brand-green-800 text-white border-brand-green-800 shadow-sm'
                    : 'bg-brand-panel text-brand-ink-soft border-brand-line hover:border-brand-gold-400/50'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="p-12 bg-brand-panel border border-brand-line rounded-2xl text-center space-y-1 shadow-sm select-none">
          <div className="text-3xl">🔍</div>
          <b className="block text-xs text-brand-ink font-bold">No results found</b>
          <p className="text-[10px] text-brand-ink-soft max-w-xs mx-auto">
            Try adjusting your category filters or search query to find the result you are looking for.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {/* Major Category Spotlight Header when filtered or viewing results */}
          {(selectedAge !== 'All' || selectedGender !== 'All') && (
            <div className="bg-gradient-to-br from-brand-gold-100 via-amber-50 to-brand-gold-100/60 border border-brand-gold-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl p-1 bg-white rounded-xl border border-brand-gold-300 shadow-2xs">🏆</span>
                <div>
                  <b className="text-xs font-extrabold text-brand-green-950 block">
                    {selectedGender !== 'All' ? selectedGender : ''} {selectedAge !== 'All' ? `${selectedAge} Division` : ''} Results
                  </b>
                  <span className="text-[10px] text-brand-gold-800 font-medium">
                    Showing {filteredResults.length} published category result{filteredResults.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  fireGoldWinnerBurst();
                  setTimeout(() => fireCelebrationConfetti(), 250);
                }}
                className="px-3 py-1.5 bg-brand-green-950 hover:bg-brand-green-900 text-brand-gold-300 text-[10px] font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
              >
                <span>🎉</span> Celebrate Winners
              </button>
            </div>
          )}

          {filteredResults.map(r => {
            const prog = db.programs.find(p => p.id === r.programId);
            const tagClass = r.gender === 'Boys' ? 'bg-sky-50 text-sky-700' : r.gender === 'Girls' ? 'bg-pink-50 text-pink-700' : 'bg-emerald-50 text-emerald-700';

            return (
              <div key={r.id} className="bg-brand-panel border border-brand-line rounded-xl p-4 shadow-sm space-y-3 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <span className="font-mono text-[9px] font-extrabold bg-brand-green-100 text-brand-green-800 px-2 py-0.5 rounded">
                      {prog?.code || '—'}
                    </span>
                    <h3 className="font-semibold text-xs md:text-sm text-brand-ink mt-1 truncate">
                      {prog?.name || 'Untitled Program'}
                    </h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${tagClass}`}>
                        {GENDER_ICONS[r.gender] || ''} {r.gender}
                      </span>
                      {r.age !== 'All' && (
                        <span className="text-[9px] font-bold bg-brand-gold-100 text-brand-gold-700 px-2 py-0.5 rounded-full">
                          {AGE_ICONS[r.age] || ''} {r.age}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Celebrate First Place winner button */}
                  {r.winners?.first?.[0] && (
                    <button
                      onClick={() => fireGoldWinnerBurst()}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition-all shrink-0 active:scale-95"
                      title="Trigger confetti celebration for 1st place winner!"
                    >
                      <span>🎉</span> Celebrate 1st
                    </button>
                  )}
                </div>

                {/* Score listing */}
                <div className="space-y-1.5 bg-brand-bg/50 p-2.5 rounded-lg border border-brand-line/50">
                  {(() => {
                    const isGeneralProg = prog?.categories.some(c => (c.gender as string) === 'General' || (c.age as string) === 'All' || (c.age as string) === 'General') || (r.gender as string) === 'General' || (r.age as string) === 'General' || (r.age as string) === 'All';

                    return ['first', 'second', 'third'].map(pos => {
                      const key = pos as 'first' | 'second' | 'third';
                      const medal = key === 'first' ? '🥇' : key === 'second' ? '🥈' : '🥉';
                      const entries = r.winners[key] || [];

                      let winPts = db.settings.points[key];
                      if (isGeneralProg) {
                        if (key === 'first') winPts = db.settings.points.generalFirst ?? db.settings.points.first;
                        else if (key === 'second') winPts = db.settings.points.generalSecond ?? db.settings.points.second;
                        else if (key === 'third') winPts = db.settings.points.generalThird ?? db.settings.points.third;
                      }

                      return entries.map((winner, winIndex) => {
                        const team = db.teams.find(t => t.id === winner.teamId);
                        const clsInfo = getCandidateClassInfo(winner.name, winner.teamId);
                        return (
                          <div key={key + winIndex} className="flex items-center justify-between text-xs py-0.5">
                            <span className="shrink-0 w-5 text-center">{medal}</span>
                            <b className="flex-1 text-brand-ink truncate ml-1 font-semibold">
                              {winner.name}
                              {clsInfo && <span className="text-[9px] text-brand-ink-soft ml-1">({clsInfo})</span>}
                            </b>
                            <span className="text-[9px] text-brand-ink-soft mr-2 shrink-0">
                              {team ? team.name : ''}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-brand-gold-700 shrink-0">
                              +{winPts}
                            </span>
                          </div>
                        );
                      });
                    });
                  })()}

                  {/* Grades listing */}
                  {r.grades && Object.entries(r.grades).map(([gradeKey, list]) => {
                    const key = gradeKey as keyof typeof r.grades;
                    const icon = key === 'gradeA' ? '🅰️' : key === 'gradeB' ? '🅱️' : key === 'gradeC' ? '🅲' : '🎗️';
                    const label = key === 'gradeA' ? 'Grade A' : key === 'gradeB' ? 'Grade B' : key === 'gradeC' ? 'Grade C' : 'Participation';
                    
                    return list.map((entry, idx) => {
                      const team = db.teams.find(t => t.id === entry.teamId);
                      const clsInfo = getCandidateClassInfo(entry.name, entry.teamId);
                      return (
                        <div key={key + idx} className="flex items-center justify-between text-xs py-0.5">
                          <span className="shrink-0 w-5 text-center">{icon}</span>
                          <b className="flex-1 text-brand-ink truncate ml-1 font-semibold">
                            {entry.name}
                            {clsInfo && <span className="text-[9px] text-brand-ink-soft ml-1">({clsInfo})</span>}
                          </b>
                          <span className="text-[9px] text-brand-ink-soft mr-2 shrink-0">
                            {team ? team.name : ''} &bull; {label}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-brand-gold-700 shrink-0">
                            +{db.settings.points[key]}
                          </span>
                        </div>
                      );
                    });
                  })}
                </div>

                <div className="flex items-center justify-between border-t border-brand-line/40 pt-2.5">
                  <span className="text-[9px] text-brand-ink-soft ml-auto">
                    {new Date(r.datetime).toLocaleDateString()} &bull; {new Date(r.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
