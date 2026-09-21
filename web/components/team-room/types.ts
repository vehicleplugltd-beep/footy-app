import type { PortfolioHealth } from "@/lib/fpl";

export type Standing = {
  entry_id: number;
  entry_name: string;
  player_name: string;
  rank: number;
  last_rank: number;
  event_total: number;
  total: number;
};

export type CounterPosture = "PROTECT" | "HYBRID" | "ATTACK";

export type CounterPathResource = {
  starting_free_transfers: number;
  ending_free_transfers: number;
  starting_bank: number;
  ending_bank: number;
  hit_cost: number;
  chips_used: Array<{
    event_id: number;
    event_name: string;
    chip: string;
  }>;
  weeks: Array<{
    event_id: number;
    event_name: string;
    transfers: Array<{
      out: { id: number; name: string; team: string };
      in: { id: number; name: string; team: string };
      weighted_gain: number;
    }>;
    captain: { id: number; name: string; team: string } | null;
    chip: string | null;
    hit_cost: number;
    free_transfers_before: number;
    free_transfers_after: number;
    bank_after: number;
    projected_mean: number;
  }>;
};

export type LeagueResponse = {
  standings?: { results: Standing[] };
};

export type ManagerResponse = {
  league_strategy?: {
    pressure_focus?: string;
    gap_above?: number | null;
    gap_below?: number | null;
    target_name?: string | null;
    chaser_name?: string | null;
    captain_moves?: Array<{
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      };
      rationale: string;
    }>;
    transfer_moves?: Array<{
      out: { id: number; name: string; team: string };
      in: { id: number; name: string; team: string };
      raw_gain: number;
      minimum_gain?: number;
      horizon_gain?: number;
      rationale: string;
    }>;
  };
  resource_map?: Array<{
    standing: Standing;
    history: {
      estimatedFreeTransfers: number;
      totalHitCost: number;
      recentHitCost: number;
      activity: "AGGRESSIVE" | "ACTIVE" | "PATIENT";
      currentHalfRemaining: string[];
      chips: Array<{ label: string; event: number }>;
    };
  }>;
  resource_advice?: {
    status: "ADVANTAGE" | "EVEN" | "THREAT" | "UNKNOWN";
    free_transfer_edge: number;
    chip_edge: string[];
    chip_threats: string[];
    recommendation: string;
  } | null;
  decision_quality?: {
    status: "ACTIVE" | "ACCUMULATING" | "UNAVAILABLE";
    tracked_from_event: number;
    pending?: {
      event: number;
      generated_at: string;
      source: string;
      posture: string | null;
      top_path: string | null;
      empirical: boolean;
      calibration_samples: number | null;
    } | null;
    completed: Array<{
      event: number;
      generated_at: string;
      model_version: string | null;
      battle_mode: string | null;
      captain: {
        process: string;
        actual_player_id: number | null;
        model_player_id: number | null;
        model_player_name: string | null;
        model_expected: number | null;
        actual_choice_expected: number | null;
        expected_ev_gap: number | null;
        actual_choice_points: number | null;
        model_choice_points: number | null;
        actual_vs_model_expectation: number | null;
      };
      transfers: {
        process: string;
        actual_in_ids: number[];
        actual_out_ids: number[];
        model_top: {
          out: { id: number; name: string; team: string; score: number };
          in: { id: number; name: string; team: string; score: number } | null;
          reason: string;
        } | null;
        model_expected_delta: number | null;
        model_actual_delta: number | null;
        hit_cost: number;
        model_hit_cost: number;
        active_chip: string | null;
        top_path_label: string | null;
        top_path_aligned: boolean;
        matched_scenario_label: string | null;
        objective_regret: number | null;
      };
      receipt: {
        source: string;
        schema: string | null;
        posture: string | null;
        calibration_status: string | null;
        calibration_samples: number | null;
      };
      bench_points: number;
    }>;
    summary: {
      deadlines: number;
      captain_process_alignment: number;
      average_captain_expected_regret: number | null;
      top_path_alignment: number;
      counterplay_comparable_deadlines: number;
      average_counterplay_objective_regret_pp: number | null;
      total_hit_cost: number;
      average_bench_points: number;
      negative_variance_deadlines: number;
      observations: string[];
    } | null;
    caveat: string;
  };
  counterplay?: {
    snapshot_event: number | null;
    managers_in_local_matrix: number;
    iterations: number;
    strategy_mode: "PROTECT" | "CHASE" | "RECOVER";
    posture: CounterPosture;
    posture_source: "USER" | "INFERRED";
    volatility_calibration: {
      status: "EMPIRICAL" | "FALLBACK";
      version: string | null;
      season: string | null;
      source: string | null;
      sample_count: number;
      generated_at: string | null;
      tail_method: string;
    };
    objective: string;
    baseline: {
      objective_probability: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
    } | null;
    game_theory_impact: {
      band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
      probability_delta: number;
      threshold_neutral: number;
      threshold_decisive: number;
      explanation: string;
    };
    horizon_results?: Partial<Record<"1" | "3" | "5", {
      horizon: number;
      event_names: string[];
      iterations: number;
      baseline: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null;
      recommended_scenario: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null;
      what_if_scenario: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null;
      scenarios: Array<{
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      }>;
      game_theory_impact: {
        band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
        probability_delta: number;
      };
    }>>;
    recommended_scenario: {
      id: string;
      label: string;
      style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
      objective_probability: number;
      probability_delta: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
      reason: string;
      transfer: {
        out: { id: number; name: string; team: string };
        in: { id: number; name: string; team: string };
      } | null;
      captain: { id: number; name: string; team: string } | null;
    } | null;
    scenarios: Array<{
      id: string;
      label: string;
      style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
      objective_probability: number;
      probability_delta: number;
      mean_score: number;
      volatility: number;
      floor_5: number;
      ceiling_95: number;
      reason: string;
    }>;
    what_if: {
      status: "IDLE" | "INVALID" | "VALID";
      error: string | null;
      selection: {
        out_id: number | null;
        in_id: number | null;
        captain_id: number | null;
      } | null;
      options: {
        bank: number;
        squad: Array<{
          id: number;
          name: string;
          team: string;
          position: string;
          price: number;
          score: number;
        }>;
        replacement_pool: Array<{
          id: number;
          name: string;
          team: string;
          position: string;
          price: number;
          score: number;
          selected_by: number;
        }>;
      };
      next_gameweek: {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        reason: string;
      } | null;
      horizons: Partial<Record<"1" | "3" | "5", {
        id: string;
        label: string;
        style: "HOLD" | "BLOCK" | "ATTACK" | "BALANCED";
        objective_probability: number;
        probability_delta: number;
        mean_score: number;
        volatility: number;
        floor_5: number;
        ceiling_95: number;
        resource_path: CounterPathResource;
      } | null>>;
      caveat: string;
    };
    local_exposure: Array<{
      player_id: number;
      squad_ownership: number;
      starter_ownership: number;
      captain_share: number;
      effective_exposure: number;
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      } | null;
    }>;
    primary_threats: Array<{
      rival_entry_id: number;
      rival_name: string;
      player: {
        id: number;
        name: string;
        team: string;
        assistantScore: number;
      };
      threat_score: number;
      local_exposure: {
        squad_ownership: number;
        starter_ownership: number;
        captain_share: number;
        effective_exposure: number;
      } | null;
      ceiling_proxy: number;
    }>;
    rival_vectors: Array<{
      entry_id: number;
      name: string;
      gap: number;
      bank: number;
      estimated_free_transfers: number | null;
      remaining_chips: string[];
      activity: string | null;
      recent_transfers: number | null;
      recent_hit_cost: number | null;
      response_confidence: number;
      response_uncertainty: "ELEVATED_CHIP_OPTIONALITY" | "DIFFUSE" | "NORMAL";
      transfer_vectors: Array<{
        out: { id: number; name: string; team: string } | null;
        in: { id: number; name: string; team: string } | null;
        label: string;
        model_share: number;
        drivers: string[];
        affordability_margin: number | null;
        caveat: string;
      }>;
    }>;
    caveats: string[];
  };
  portfolio_plan?: {
    action: "BANK" | "HOLD" | "TRANSFER" | "STRUCTURAL_REPAIR" | "CHIP_PREP";
    headline: string;
    portfolio: PortfolioHealth;
    decision_driver: "GAME_THEORY_TIEBREAK" | "FOOTBALL_PORTFOLIO" | "PORTFOLIO_STRUCTURE";
    game_theory: {
      band: "NEUTRAL" | "MATERIAL" | "DECISIVE";
      probability_delta: number;
      threshold_neutral: number;
      threshold_decisive: number;
      explanation: string;
      used_as_tiebreak: boolean;
      football_primary_transfer: {
        out: string;
        in: string;
        raw_gain: number;
        horizon_gain: number;
      } | null;
      selected_transfer: {
        out: string;
        in: string;
        raw_gain: number;
        horizon_gain: number;
      } | null;
    };
    free_transfers: number | null;
    hit_cost_for_one_extra_move: number | null;
    chip_signal: {
      chip: string;
      status: string;
      eventName: string | null;
      reason: string;
    } | null;
    league_mode: "PROTECT" | "CHASE" | "RECOVER";
    field_ownership_proxy: {
      average_squad_ownership: number;
      high_ownership_assets: number;
      differentials_under_10: number;
      caveat: string;
    };
    differential_guidance: string;
    why: string[];
    failure_modes: string[];
    underlying: string[];
    missing: string[];
    resource_status: string;
    caveat: string;
  };
};
