import xss from 'xss';
import { Report } from '../models/Report.js';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { AnonymousIdentity } from '../models/AnonymousIdentity.js';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { ModeratorAction } from '../models/ModeratorAction.js';

export async function submitReport(req, res, next) {
  try {
    const { targetType, targetId, reason, explanation } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Target type, target ID, and reason are required.'
      });
    }

    // Prevent duplicate report spam from same user within 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await Report.findOne({
      reporter: req.identity._id,
      targetId,
      createdAt: { $gt: oneHourAgo }
    });

    if (existing) {
      return res.status(429).json({
        success: false,
        error: 'You have already submitted a report for this item recently.'
      });
    }

    const report = await Report.create({
      reporter: req.identity._id,
      targetType,
      targetId,
      reason,
      explanation: explanation ? xss(explanation.trim().slice(0, 500)) : ''
    });

    res.status(201).json({
      success: true,
      reportId: report._id,
      message: 'Thank you for helping keep ANON safe. The report has been queued for moderation review.'
    });
  } catch (error) {
    next(error);
  }
}

export async function listReports(req, res, next) {
  try {
    const { status = 'pending', targetType, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status !== 'all') {
      query.status = status;
    }
    if (targetType) {
      query.targetType = targetType;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const take = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .populate('reporter', 'username'),
      Report.countDocuments(query)
    ]);

    // Enhance reports with target preview info
    const enhancedReports = await Promise.all(
      reports.map(async r => {
        let targetSummary = null;
        try {
          if (r.targetType === 'post') {
            const post = await Post.findById(r.targetId).populate('author', 'username');
            if (post) {
              targetSummary = {
                title: post.title,
                content: post.content.slice(0, 200),
                author: post.author?.username,
                isDeleted: post.isDeleted
              };
            }
          } else if (r.targetType === 'reply') {
            const reply = await Reply.findById(r.targetId).populate('author', 'username');
            if (reply) {
              targetSummary = {
                content: reply.content.slice(0, 200),
                author: reply.author?.username,
                isDeleted: reply.isDeleted
              };
            }
          } else if (r.targetType === 'user') {
            const user = await AnonymousIdentity.findById(r.targetId);
            if (user) {
              targetSummary = {
                username: user.username,
                status: user.status
              };
            }
          }
        } catch {
          // target may be deleted or invalid
        }

        return {
          id: r._id,
          targetType: r.targetType,
          targetId: r.targetId,
          targetSummary,
          reason: r.reason,
          explanation: r.explanation,
          status: r.status,
          reporterUsername: r.reporter?.username || 'Anonymous',
          reviewedBy: r.reviewedBy,
          resolutionNotes: r.resolutionNotes,
          createdAt: r.createdAt,
          resolvedAt: r.resolvedAt
        };
      })
    );

    res.json({
      success: true,
      reports: enhancedReports,
      total,
      page: parseInt(page, 10),
      pages: Math.ceil(total / take)
    });
  } catch (error) {
    next(error);
  }
}

export async function resolveReport(req, res, next) {
  try {
    const { id } = req.params;
    const { action, resolutionNotes } = req.body; // 'dismiss' or 'take_action'

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, error: 'Report not found.' });
    }

    report.status = action === 'dismiss' ? 'resolved_dismissed' : 'resolved_action_taken';
    report.reviewedBy = req.moderatorId;
    report.resolutionNotes = resolutionNotes ? xss(resolutionNotes.trim()) : '';
    report.resolvedAt = new Date();
    await report.save();

    await ModeratorAction.create({
      actionType: action === 'dismiss' ? 'dismiss_report' : 'remove_post',
      targetType: report.targetType,
      targetId: report.targetId,
      performedBy: req.moderatorId,
      reason: report.reason,
      metadata: { reportId: report._id, action, notes: resolutionNotes }
    });

    res.json({
      success: true,
      message: `Report resolved (${action}).`
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContentModeration(req, res, next) {
  try {
    const { targetType, targetId, reason } = req.body;

    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ success: false, error: 'Type, ID, and reason are required.' });
    }

    let modified = false;

    if (targetType === 'post') {
      const post = await Post.findById(targetId);
      if (post) {
        post.isDeleted = true;
        post.deletedReason = xss(reason.trim());
        await post.save();
        modified = true;
      }
    } else if (targetType === 'reply') {
      const reply = await Reply.findById(targetId);
      if (reply) {
        reply.isDeleted = true;
        await reply.save();
        modified = true;
      }
    }

    if (!modified) {
      return res.status(404).json({ success: false, error: 'Target content not found.' });
    }

    await ModeratorAction.create({
      actionType: targetType === 'post' ? 'remove_post' : 'remove_reply',
      targetType,
      targetId,
      performedBy: req.moderatorId,
      reason: xss(reason.trim())
    });

    res.json({
      success: true,
      message: `Content (${targetType}) removed by moderator.`
    });
  } catch (error) {
    next(error);
  }
}

export async function suspendIdentityModeration(req, res, next) {
  try {
    const { identityId, reason, action = 'suspend' } = req.body;

    const identity = await AnonymousIdentity.findById(identityId);
    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found.' });
    }

    identity.status = action === 'suspend' ? 'suspended' : 'active';
    identity.suspensionReason = action === 'suspend' ? xss(reason || 'Violation of community safety standards.') : '';
    await identity.save();

    await ModeratorAction.create({
      actionType: action === 'suspend' ? 'suspend_identity' : 'unsuspend_identity',
      targetType: 'identity',
      targetId: identity._id.toString(),
      performedBy: req.moderatorId,
      reason: xss(reason || 'Moderator decision')
    });

    res.json({
      success: true,
      message: `Identity ${identity.username} ${action}ed.`
    });
  } catch (error) {
    next(error);
  }
}

export async function listPendingProfessionals(req, res, next) {
  try {
    const professionals = await ProfessionalAccount.find({ verificationStatus: 'pending' })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      professionals: professionals.map(p => ({
        id: p._id,
        email: p.email,
        fullName: p.fullName,
        displayName: p.displayName,
        licenseType: p.licenseType,
        licenseNumber: p.licenseNumber,
        licenseJurisdiction: p.licenseJurisdiction,
        specialties: p.specialties,
        languages: p.languages,
        bio: p.bio,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function reviewProfessionalVerification(req, res, next) {
  try {
    const { id } = req.params;
    const { decision, notes } = req.body; // 'verify' or 'reject'

    if (!['verify', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be "verify" or "reject".' });
    }

    const professional = await ProfessionalAccount.findById(id);
    if (!professional) {
      return res.status(404).json({ success: false, error: 'Professional account not found.' });
    }

    professional.verificationStatus = decision === 'verify' ? 'verified' : 'rejected';
    professional.verifiedAt = decision === 'verify' ? new Date() : null;
    professional.verificationNotes = notes ? xss(notes.trim()) : '';
    await professional.save();

    await ModeratorAction.create({
      actionType: decision === 'verify' ? 'verify_professional' : 'reject_professional',
      targetType: 'professional',
      targetId: professional._id.toString(),
      performedBy: req.moderatorId,
      reason: notes || `Credential review: ${decision}`
    });

    res.json({
      success: true,
      message: `Professional account ${decision}ed successfully.`,
      verificationStatus: professional.verificationStatus
    });
  } catch (error) {
    next(error);
  }
}
